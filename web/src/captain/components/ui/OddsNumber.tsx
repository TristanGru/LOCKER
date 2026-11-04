import { animate, useMotionValue, useTransform, motion } from 'framer-motion';
import { useEffect, type CSSProperties } from 'react';

/** Percentage that counts up/down smoothly whenever the value changes. */
export function OddsNumber({ value, className, duration = 1.1, style }: { value: number; className?: string; duration?: number; style?: CSSProperties }) {
  const mv = useMotionValue(Number.isFinite(value) ? value * 100 : 0);
  const text = useTransform(mv, (v) => `${Math.round(v)}`);
  useEffect(() => {
    const controls = animate(mv, Number.isFinite(value) ? value * 100 : 0, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, mv]);
  if (!Number.isFinite(value)) return <span className={className} style={style}>Unknown</span>;
  return (
    <span className={className} style={style}>
      <motion.span className="num">{text}</motion.span>
      <span className="num opacity-60">%</span>
    </span>
  );
}
