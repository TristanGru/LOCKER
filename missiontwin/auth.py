"""Sign-in and per-request access checks.

Every /api request must carry a signed session cookie. Nothing is trusted for being on the same network or
host: the cookie is verified on each request, the account is looked up again (so a removed account stops
working at once), and every route checks the units the account may see or change.

Accounts (username only for now; no password):
- one Commanding Officer per ship, ``co.<ship id>`` (for example ``co.kessler``): that ship only;
- one fleet account (``FLEET_USER``): every ship and installation, and the exercise controls.

The account list is derived from the data profile, so a new ship in the profile gets its own CO account.
"""
from __future__ import annotations

import base64
import contextvars
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import HTTPException

FLEET_USER = "fleet.commander@us.navy.mil"
COOKIE = "locker_session"
SESSION_SECONDS = 8 * 3600
SHARED_FOLDERS = ("squadron/",)  # squadron-wide files (positions, wholesale stock) every account may read

_current: contextvars.ContextVar[dict | None] = contextvars.ContextVar("locker_user", default=None)


def accounts(profile) -> dict[str, dict]:
    """username -> account. A CO account per ship; one fleet account for every unit."""
    every = list(profile.ship_ids)
    out = {FLEET_USER: {"username": FLEET_USER, "role": "fleet", "title": "Fleet Commander", "detail": "All ships and installations",
                        "units": every}}
    for unit in every:
        if profile.kind_of(unit) != "ship":
            continue
        ship = profile.ships[unit]
        name = f"co.{unit.lower()}"
        out[name] = {"username": name, "role": "co", "title": f"Commanding Officer, {ship['name']}",
                     "detail": f"{ship['name']} ({ship['hull']}) only", "units": [unit]}
    return out


class Sessions:
    """Signed, expiring session tokens. The key is per process unless MISSIONTWIN_SESSION_SECRET is set."""

    def __init__(self, secret: str | None = None):
        key = secret or os.environ.get("MISSIONTWIN_SESSION_SECRET", "")
        self.key = key.encode() if key else secrets.token_bytes(32)
        self.revoked: dict[str, float] = {}  # signature -> expiry; a signed-out token stops working at once

    def _sign(self, body: bytes) -> str:
        return base64.urlsafe_b64encode(hmac.new(self.key, body, hashlib.sha256).digest()).decode().rstrip("=")

    def issue(self, username: str) -> str:
        now = int(time.time())
        body = base64.urlsafe_b64encode(json.dumps({"u": username, "iat": now, "exp": now + SESSION_SECONDS}).encode()).decode().rstrip("=")
        return body + "." + self._sign(body.encode())

    def verify(self, token: str | None) -> str | None:
        """The username in a valid, unexpired token, else None."""
        if not token or token.count(".") != 1:
            return None
        body, sig = token.split(".")
        if not hmac.compare_digest(sig, self._sign(body.encode())) or sig in self.revoked:
            return None
        try:
            claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        except (ValueError, TypeError):
            return None
        if not isinstance(claims, dict) or not isinstance(claims.get("u"), str) or claims.get("exp", 0) < time.time():
            return None
        return claims["u"]

    def revoke(self, token: str | None):
        """Sign-out: refuse this token from now on (kept until it would have expired anyway)."""
        if not token or token.count(".") != 1:
            return
        now = time.time()
        self.revoked = {s: exp for s, exp in self.revoked.items() if exp > now}
        self.revoked[token.split(".")[1]] = now + SESSION_SECONDS


# ------------------------------------------------------------------ current request
def set_user(account: dict | None):
    return _current.set(account)


def reset_user(token):
    _current.reset(token)


def user() -> dict | None:
    return _current.get()


def username() -> str:
    u = user()
    return u["username"] if u else "system"


def is_fleet() -> bool:
    u = user()
    return u is None or u["role"] == "fleet"  # None only outside a request (startup warm-up, scripts)


def public(account: dict) -> dict:
    return {k: account[k] for k in ("username", "role", "title", "detail", "units")}


# ------------------------------------------------------------------ checks (raise 403)
class Denied(HTTPException):
    def __init__(self, reason: str):
        super().__init__(403, reason)


def allow_unit(unit: str | None):
    u = user()
    if u is None or u["role"] == "fleet" or unit is None:
        return
    if unit not in u["units"]:
        raise Denied(f"{u['username']} is not authorized for {unit}.")


def fleet_only(what: str):
    if not is_fleet():
        raise Denied(f"{what} is limited to fleet staff.")


def allow_file(file: str):
    """COs read their own ship's folder and the squadron-wide folder only."""
    u = user()
    if u is None or u["role"] == "fleet" or file.startswith("logs/"):
        return
    if file.startswith(SHARED_FOLDERS) or any(file.startswith(unit + "/") for unit in u["units"]):
        return
    raise Denied(f"{u['username']} is not authorized for {file.split('/')[0]} records.")


# ------------------------------------------------------------------ response scoping
def scoped(payload, all_units):
    """Remove every other unit's data from a response for a single-unit account.

    Drops dict keys named after another unit (``units``, ``coverage``, ``ships`` ...), list items owned by
    another unit (``ship_id``/``unit``/``receiver``, an action payload's ``ship_id``, or a ``file`` in another
    unit's folder) and unit ids in plain lists. Graph edges that lose an end are dropped with it.
    """
    u = user()
    if u is None or u["role"] == "fleet":
        return payload
    others = set(all_units) - set(u["units"])
    return _scope(payload, others) if others else payload


def _owner(d: dict, others: set) -> bool:
    for key in ("ship_id", "unit", "unit_id", "receiver"):
        if d.get(key) in others:
            return True
    p = d.get("payload")
    if isinstance(p, dict) and p.get("ship_id") in others:
        return True
    f = d.get("file")
    return isinstance(f, str) and f.split("/")[0] in others


def _scope(o, others):
    if isinstance(o, dict):
        out = {k: _scope(v, others) for k, v in o.items() if k not in others}
        if isinstance(out.get("nodes"), list) and isinstance(out.get("edges"), list):
            kept = {n.get("id") for n in out["nodes"] if isinstance(n, dict)}
            out["edges"] = [e for e in out["edges"] if not isinstance(e, dict) or (e.get("source") in kept and e.get("target") in kept)]
        return out
    if isinstance(o, list):
        return [_scope(v, others) for v in o
                if not (isinstance(v, dict) and _owner(v, others)) and not (isinstance(v, str) and v in others)]
    return o


LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1", "testserver"}


def assistant_host_allowed(host: str) -> bool:
    """The assistants answer only on hosts this deployment serves: this machine, the Vercel deployment's own
    domains (VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_PROJECT_PRODUCTION_URL, set by Vercel) and any custom domains
    listed in LOCKER_ALLOWED_HOSTS (comma separated)."""
    from urllib.parse import urlsplit
    name = urlsplit("http://" + (host or "")).hostname
    hosted = {os.environ.get(k, "") for k in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL")}
    hosted |= set(os.environ.get("LOCKER_ALLOWED_HOSTS", "").split(","))
    return bool(name) and (name in LOCAL_HOSTS or name in {h.strip().lower() for h in hosted if h.strip()})
