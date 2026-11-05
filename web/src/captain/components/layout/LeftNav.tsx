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
  group: string;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Ship Overview', icon: Ship, group: 'Picture' },
  { to: '/shore', label: 'Shore Overview', icon: Building2, group: 'Picture' },
  { to: '/missions', label: 'Mission Overview', icon: LayoutDashboard, group: 'Picture' },
  { to: '/dominoes', label: "Davy's Dominoes", icon: Network, group: 'Analysis' },
  { to: '/fixes', label: 'Fixes', icon: Wrench, group: 'Analysis' },
  { to: '/what-if', label: 'What-If', icon: FlaskConical, group: 'Analysis' },
  { to: '/feed', label: 'Change Feed', icon: Radio, group: 'Record' },
  { to: '/brief', label: 'Readiness Brief', icon: FileText, group: 'Record' },
  { to: '/log', label: 'Activity Log', icon: ScrollText, group: 'Record' },
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
          className="grid h-8 w-8 place-items-center rounded text-ink-muted transition hover:bg-abyss-800 hover:text-ink"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      <ul className="flex-1 pb-3">
        {NAV.map((item, i) => (
          <li key={item.to}>
            {item.group !== NAV[i - 1]?.group &&
              (collapsed ? (
                <div className="mx-3 my-2 border-t border-line" aria-hidden />
              ) : (
                <div className="px-4 pb-1.5 pt-4 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-dim">{item.group}</div>
              ))}
            <NavLink
              to={item.to}
              end={item.to === '/'}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 border-l-[3px] py-2 text-[0.93rem] transition-colors',
                  collapsed ? 'justify-center px-0' : 'pl-[13px] pr-3',
                  isActive ? 'border-accent bg-abyss-800 font-semibold text-ink' : 'border-transparent font-medium text-ink-muted hover:bg-abyss-800 hover:text-ink',
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
        <div className={clsx('flex items-center gap-2 text-sm text-ink-muted', collapsed && 'justify-center')} title="Synthetic exercise · local demo">
          <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className={collapsed ? 'sr-only' : undefined}>Synthetic exercise · local demo</span>
        </div>
      </div>
    </nav>
  );
}
