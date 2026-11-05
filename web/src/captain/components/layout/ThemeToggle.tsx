import { Moon, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import clsx from '../../lib/clsx';
import { applyColorMode, readColorMode, type ColorMode } from '../../theme/colorMode';

export function ThemeToggle() {
  const [mode, setMode] = useState<ColorMode>(readColorMode);

  function choose(next: ColorMode) {
    applyColorMode(next);
    setMode(next);
  }

  return (
    <div role="group" aria-label="Color mode" className="flex rounded-lg border border-line p-0.5">
      <ModeButton current={mode} value="light" onChoose={choose} icon={<Sun className="h-4 w-4" aria-hidden />} label="Light" />
      <ModeButton current={mode} value="dark" onChoose={choose} icon={<Moon className="h-4 w-4" aria-hidden />} label="Dark" />
    </div>
  );
}

function ModeButton({
  current,
  value,
  onChoose,
  icon,
  label,
}: {
  current: ColorMode;
  value: ColorMode;
  onChoose: (mode: ColorMode) => void;
  icon: ReactNode;
  label: string;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onChoose(value)}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition',
        selected ? 'bg-accent/15 text-ink' : 'text-ink-muted hover:bg-ink/[0.06] hover:text-ink',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
