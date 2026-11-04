"""One-click readiness brief. Deterministic template from the forecast; the LLM may only rewrite it (job c).

Every claim carries a citation [n] to a source record. No display names: people are member_id + rate (spec 20).
"""
from __future__ import annotations

from . import BANNER
from .domain import SHIPS, format_dtg, local_label, parse_ts


def build_brief(fc: dict, ship_id: str, ranking: dict | None, contradictions: list, stale: dict, decisions: list) -> dict:
    cites: list[dict] = []

    def cite(srcs) -> str:
        marks = []
        for s in srcs[:3]:
            key = (s.get("file"), s.get("loc"))
            idx = next((i for i, c in enumerate(cites) if (c.get("file"), c.get("loc")) == key), None)
            if idx is None:
                cites.append({k: s.get(k, "") for k in ("file", "loc", "key", "span")})
                idx = len(cites) - 1
            marks.append(f"[{idx + 1}]")
        return "".join(marks)

    info = SHIPS[ship_id]
    now = parse_ts(fc["cursor"])
    L = [BANNER, f"READINESS BRIEF  {info['name']} ({info['hull']})",
         f"As of {fc['cursor_dtg']} ({local_label(now)}). Seed {fc['seed']}, {fc['runs']:,} runs. Read-only; the captain decides.", "",
         "BOTTOM LINE"]
    ctx_missions = []
    for m in fc["missions"]:
        if m["ship_id"] != ship_id:
            continue
        pl = m["planned"] or {}
        margin = pl.get("margin_days")
        plan_txt = f"Planned (on stated ETAs): {pl.get('result')}"
        if margin is not None:
            plan_txt += f", {abs(margin):.1f} days {'margin' if margin >= 0 else 'late'}"
        elif pl.get("result") == "MISS":
            plan_txt += ", not ready inside the horizon"
        srcs = m["sources"]
        L.append(f"- {m['label']} ({m['name']}, {m['start_dtg']}): {m['band']}, {m['p_ready'] * 100:.0f}% ready (risk, seeded runs). "
                 f"{plan_txt}. {cite(srcs)}")
        if m.get("moved_note"):
            L.append(f"  Mission date {m['moved_note']}.")
        ctx_missions.append({"label": m["label"], "p_ready": m["p_ready"], "band": m["band"], "planned": pl.get("result"), "margin_days": margin})
    L += ["", "NEXT DOMINO"]
    for m in fc["missions"]:
        if m["ship_id"] != ship_id or not m["next_domino"]:
            continue
        g = next(x for x in m["gates"] if x["gate_id"] == m["next_domino"])
        srcs = []
        for it in g.get("items", []):
            srcs += it.get("sources", [])
        L.append(f"- {m['label']}: {g['label']} (P ok {g['p_ok'] * 100:.0f}%; making it certain adds {g['uplift'] * 100:.0f} pts). {cite(srcs)}")
        for ch in (m["planned"] or {}).get("chain", [])[:3]:
            for w in ch["why"][:3]:
                L.append(f"    {w.strip()}")
    if ranking and ranking.get("candidates"):
        L += ["", "RANKED FIXES (for decision)"]
        for c in ranking["candidates"][:3]:
            eff = "; ".join(f"{x['label']} {x['p_before'] * 100:.0f}%->{x['p_after'] * 100:.0f}%" for x in c["missions"] if x["ship_id"] == ship_id)
            donor = "; ".join(f"{s}: missions {v['mission_p_delta'] * 100:+.1f} pts, capability {v['capability_delta'] * 100:+.1f} pts"
                              for s, v in c["donor_effects"].items()) or "no donor cost"
            L.append(f"- #{c['rank']} {c['title']}. {eff}. Donor: {donor}.")
    if decisions:
        L += ["", "DECISIONS LOGGED"]
        for d in decisions:
            L.append(f"- {d['scenario_time']}: {d['payload'].get('decision', '').upper()} {d['payload'].get('fix', {}).get('title', '')}")
    mine = [c for c in contradictions if c["ship_id"] == ship_id]
    if mine or stale:
        L += ["", "DATA WARNINGS"]
        for c in mine[:6]:
            L.append(f"- {c['id']}: {c['title']}. {cite(c['sources'])}")
    L += ["", "SOURCES"]
    for i, c in enumerate(cites, 1):
        L.append(f"[{i}] {c['file']} {c['loc']}".rstrip() + (f" \"{c['span'][:90]}\"" if c.get("span") else ""))
    L += ["", BANNER]
    context = {"ship": info["name"], "as_of": fc["cursor_dtg"], "missions": ctx_missions}
    return {"text": "\n".join(L), "citations": cites, "context": context}
