import {
  FileText,
  FlaskConical,
  LayoutDashboard,
  Network,
  Radio,
  RotateCcw,
  ScrollText,
  Ship,
  WifiOff,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../api/api';
import clsx from '../../lib/clsx';
import { useStore } from '../../state/store';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Ship Overview', icon: Ship },
  { to: '/missions', label: 'Mission Overview', icon: LayoutDashboard },
  { to: '/dominoes', label: "Davy's Dominoes", icon: Network },
  { to: '/fixes', label: 'Fixes', icon: Wrench },
  { to: '/feed', label: 'Change Feed', icon: Radio },
  { to: '/what-if', label: 'What-If', icon: FlaskConical },
  { to: '/brief', label: 'Readiness Brief', icon: FileText },
  { to: '/log', label: 'Activity Log', icon: ScrollText },
];

export function LeftNav() {
  const { bump, closePanel, setCascade } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  async function reset() {
    if (!confirmReset) return setConfirmReset(true);
    setResetting(true);
    try {
      await api.resetDemo();
      closePanel();
      setCascade(null);
      bump();
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  return (
    <nav aria-label="Main" className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-abyss-900">
      <ul className="flex-1 space-y-1 p-3 pt-4">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.95rem] font-semibold transition-colors',
                  isActive ? 'bg-white/[0.07] text-ink' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx('h-[1.15rem] w-[1.15rem] shrink-0', isActive ? 'text-accent' : 'text-ink-muted')} aria-hidden />
                  <span className="min-w-0 truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-line p-4">
        <button onClick={reset} disabled={resetting} className={clsx('w-full', confirmReset ? 'btn-risk' : 'btn-ghost')}>
          <RotateCcw className={clsx('h-4 w-4', resetting && 'animate-spin')} aria-hidden />
          {confirmReset ? 'Click again to reset' : 'Reset demo'}
        </button>
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          Offline · demo data · fictional
        </div>
      </div>
    </nav>
  );
}
