import {
  Building2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
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
  { to: '/shore', label: 'Shore Overview', icon: Building2 },
  { to: '/missions', label: 'Mission Overview', icon: LayoutDashboard },
  { to: '/dominoes', label: "Davy's Dominoes", icon: Network },
  { to: '/fixes', label: 'Fixes', icon: Wrench },
  { to: '/feed', label: 'Change Feed', icon: Radio },
  { to: '/what-if', label: 'What-If', icon: FlaskConical },
  { to: '/brief', label: 'Readiness Brief', icon: FileText },
  { to: '/log', label: 'Activity Log', icon: ScrollText },
];

const NAV_KEY = 'locker-nav-collapsed';

export function LeftNav() {
  const { bump, closePanel, setCascade } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NAV_KEY) === '1';
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    setCollapsed((open) => {
      const next = !open;
      try {
        localStorage.setItem(NAV_KEY, next ? '1' : '0');
      } catch {
        /* The choice still applies for this visit. */
      }
      return next;
    });
  }

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
    <nav
      aria-label="Main"
      className={clsx(
        'flex h-full shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-line bg-abyss-900 transition-[width] duration-200',
        collapsed ? 'w-[4.25rem]' : 'w-56',
      )}
    >
      <div className={clsx('flex px-3 pt-3', collapsed ? 'justify-center' : 'justify-end')}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ink/[0.06] hover:text-ink"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      <ul className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg py-2.5 text-[0.95rem] font-semibold transition-colors',
                  collapsed ? 'justify-center px-0' : 'px-3',
                  isActive ? 'bg-ink/[0.08] text-ink' : 'text-ink-muted hover:bg-ink/[0.06] hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx('h-[1.15rem] w-[1.15rem] shrink-0', isActive ? 'text-accent' : 'text-ink-muted')} aria-hidden />
                  <span className={clsx('min-w-0 truncate', collapsed && 'sr-only')}>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className={clsx('space-y-3 border-t border-line', collapsed ? 'p-2' : 'p-4')}>
        <button
          onClick={reset}
          disabled={resetting}
          title={confirmReset ? 'Click again to reset' : 'Reset demo'}
          className={clsx(collapsed ? 'grid h-10 w-full place-items-center px-0' : 'w-full', confirmReset ? 'btn-risk' : 'btn-ghost')}
        >
          <RotateCcw className={clsx('h-4 w-4', resetting && 'animate-spin')} aria-hidden />
          <span className={collapsed ? 'sr-only' : undefined}>{confirmReset ? 'Click again to reset' : 'Reset demo'}</span>
        </button>
        <div className={clsx('flex items-center gap-2 text-sm text-ink-muted', collapsed && 'justify-center')} title="Offline · demo data · fictional">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={collapsed ? 'sr-only' : undefined}>Offline · demo data · fictional</span>
        </div>
      </div>
    </nav>
  );
}
