import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, currentShip, selectShip, type Account } from '../api/api';
import { Login } from '../screens/Login';

interface AuthValue {
  user: Account;
  isFleet: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

/** Shows the sign-in screen until the server confirms a session, and again whenever a request comes back 401. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null | undefined>(undefined);

  const accept = useCallback((account: Account) => {
    // A CO lands on their own ship; the fleet account keeps whatever unit was last selected.
    if (!account.units.includes(currentShip())) selectShip(account.units[0]);
    setUser(account);
  }, []);

  useEffect(() => {
    auth.session().then((a) => (a ? accept(a) : setUser(null)), () => setUser(null));
    const out = () => setUser(null);
    window.addEventListener('locker:signed-out', out);
    return () => window.removeEventListener('locker:signed-out', out);
  }, [accept]);

  const signOut = useCallback(async () => {
    // Unmount the views first so no polling request goes out on the ending session, then show the sign-in
    // screen only once the server has revoked it.
    setUser(undefined);
    await auth.logout().catch(() => undefined);
    setUser(null);
  }, []);

  if (user === undefined) return null;
  if (user === null) return <Login onSignedIn={accept} />;
  return (
    <Ctx.Provider value={{ user, isFleet: user.role === 'fleet', signOut }}>
      {/* Remount everything on a new account so no view keeps the previous account's data. */}
      <div key={user.username} className="h-full">{children}</div>
    </Ctx.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthGate>');
  return v;
}
