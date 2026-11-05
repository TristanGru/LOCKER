import { Anchor, LogIn, ShieldCheck, Star } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { auth, type Account } from '../api/api';
import { LogoMark } from '../components/layout/Logo';

type Choice = Omit<Account, 'units'>;

/** Username-only sign-in (no password yet). The server issues a signed session and checks it on every request. */
export function Login({ onSignedIn }: { onSignedIn: (a: Account) => void }) {
  const [accounts, setAccounts] = useState<Choice[]>([]);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { auth.accounts().then(setAccounts, () => setAccounts([])); }, []);

  async function signIn(name: string) {
    setBusy(true);
    setError('');
    try {
      onSignedIn(await auth.login(name));
    } catch {
      setError(`No account named "${name.trim()}". Pick one of the accounts below.`);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (username.trim()) void signIn(username);
  }

  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-abyss-950 p-6">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark className="h-12 w-12" />
          <div>
            <div className="text-[1.6rem] font-extrabold tracking-[0.16em] text-ink">LOCKER</div>
            <div className="text-sm text-ink-muted">Mission readiness · synthetic exercise</div>
          </div>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-6">
          <h1 className="text-xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Each account sees only the units it is responsible for.</p>
          <label htmlFor="username" className="mt-5 block text-sm font-semibold text-ink">Username</label>
          <input
            id="username"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="co.kessler or fleet.commander@us.navy.mil"
            className="mt-2 w-full rounded-lg border border-line bg-abyss-900 px-3 py-2.5 text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none"
          />
          {error && <p role="alert" className="mt-2 text-sm text-risk">{error}</p>}
          <button type="submit" disabled={busy || !username.trim()} className="btn-accent mt-4 w-full justify-center py-2.5">
            <LogIn className="h-4 w-4" aria-hidden /> Sign in
          </button>
        </form>

        {accounts.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">Demo accounts</h2>
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li key={a.username}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void signIn(a.username)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-abyss-900 px-4 py-3 text-left transition hover:border-accent/60 hover:bg-ink/[0.04]"
                  >
                    {a.role === 'fleet' ? <Star className="h-5 w-5 shrink-0 text-accent" aria-hidden /> : <Anchor className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{a.title}</span>
                      <span className="block truncate text-sm text-ink-muted">{a.detail}</span>
                    </span>
                    <span className="num shrink-0 text-sm text-ink-dim">{a.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-sm text-ink-dim">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Demo sign-in by username only. Every request is checked on the server, and other units&apos; records are never sent to the browser.
        </p>
      </div>
    </div>
  );
}
