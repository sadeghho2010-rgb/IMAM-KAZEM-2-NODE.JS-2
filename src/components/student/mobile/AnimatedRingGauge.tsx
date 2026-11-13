import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../../lib/utils';

interface AnimatedRingGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  progressClassName?: string;
  label?: string;
  valueText: string;
  subText?: string;
}

export const AnimatedRingGauge: React.FC<AnimatedRingGaugeProps> = ({
  percentage,
  size = 64,
  strokeWidth = 6,
  trackClassName = 'text-white/15',
  progressClassName = 'text-cyan-400',
  valueText,
  label,
  subText,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className={trackClassName}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={prefersReducedMotion ? { strokeDashoffset } : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: 'easeOut' }}
            className={progressClassName}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-white tabular-nums">{Math.round(clamped)}٪</span>
        </div>
      </div>

      <div className="min-w-0">
        {label && <div className="text-[10px] text-slate-300 font-bold truncate">{label}</div>}
        <div className="text-xs font-black text-white tabular-nums truncate">{valueText}</div>
        {subText && <div className={cn('text-[9.5px] font-medium truncate text-slate-300/90 tabular-nums')}>{subText}</div>}
      </div>
    </div>
  );
};
