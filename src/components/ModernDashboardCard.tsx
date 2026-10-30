import React, { useState, useRef, useCallback } from 'react';

/**
 * Color theme presets for the card lighting and glow accents.
 */
export type CardAccentColor = 'emerald' | 'indigo' | 'amber' | 'rose' | 'cyan' | 'violet';

export interface ModernDashboardCardProps {
  /** Main numeric or text metric to display */
  value: string | number;
  /** Secondary metric, description, or sub-label */
  subValue?: string;
  /** Trend change percentage or text (e.g. "+۱۲.۴٪") */
  trendText?: string;
  /** Direction of trend: positive (up), negative (down), or neutral */
  trendDirection?: 'up' | 'down' | 'neutral';
  /** Comparison context label (e.g. "نسبت به ماه قبل") */
  trendContext?: string;
  /** Custom Icon node or component */
  icon?: React.ReactNode;
  /** Visual accent theme for ambient glow and spotlight */
  accent?: CardAccentColor;
  /** Sparkline mini-graph data points (e.g. [12, 18, 15, 26, 32, 28, 40]) */
  sparklineData?: number[];
  /** Optional status beacon mode */
  status?: 'active' | 'warning' | 'idle';
  /** Optional badge/tag text (e.g. "بروزرسانی زنده") */
  badgeText?: string;
  /** Click handler */
  onClick?: () => void;
  /** Custom container class */
  className?: string;
}

// Color palettes for ambient glows, spotlights, borders, and light streaks
const ACCENT_STYLES: Record<CardAccentColor, {
  glow: string;
  spotlight: string;
  sparkStroke: string;
  sparkFill: string;
  iconBg: string;
  iconColor: string;
  shimmer: string;
  rimBorder: string;
}> = {
  emerald: {
    glow: 'rgba(16, 185, 129, 0.22)',
    spotlight: 'rgba(16, 185, 129, 0.16)',
    sparkStroke: '#10b981',
    sparkFill: 'rgba(16, 185, 129, 0.12)',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    iconColor: '#10b981',
    shimmer: 'from-emerald-400/0 via-emerald-400/20 to-emerald-400/0',
    rimBorder: 'group-hover:border-emerald-500/40',
  },
  indigo: {
    glow: 'rgba(99, 102, 241, 0.22)',
    spotlight: 'rgba(99, 102, 241, 0.16)',
    sparkStroke: '#6366f1',
    sparkFill: 'rgba(99, 102, 241, 0.12)',
    iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    iconColor: '#6366f1',
    shimmer: 'from-indigo-400/0 via-indigo-400/20 to-indigo-400/0',
    rimBorder: 'group-hover:border-indigo-500/40',
  },
  amber: {
    glow: 'rgba(245, 158, 11, 0.22)',
    spotlight: 'rgba(245, 158, 11, 0.16)',
    sparkStroke: '#f59e0b',
    sparkFill: 'rgba(245, 158, 11, 0.12)',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    iconColor: '#f59e0b',
    shimmer: 'from-amber-400/0 via-amber-400/20 to-amber-400/0',
    rimBorder: 'group-hover:border-amber-500/40',
  },
  rose: {
    glow: 'rgba(244, 63, 94, 0.22)',
    spotlight: 'rgba(244, 63, 94, 0.16)',
    sparkStroke: '#f43f5e',
    sparkFill: 'rgba(244, 63, 94, 0.12)',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    iconColor: '#f43f5e',
    shimmer: 'from-rose-400/0 via-rose-400/20 to-rose-400/0',
    rimBorder: 'group-hover:border-rose-500/40',
  },
  cyan: {
    glow: 'rgba(6, 182, 212, 0.22)',
    spotlight: 'rgba(6, 182, 212, 0.16)',
    sparkStroke: '#06b6d4',
    sparkFill: 'rgba(6, 182, 212, 0.12)',
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    iconColor: '#06b6d4',
    shimmer: 'from-cyan-400/0 via-cyan-400/20 to-cyan-400/0',
    rimBorder: 'group-hover:border-cyan-500/40',
  },
  violet: {
    glow: 'rgba(139, 92, 246, 0.22)',
    spotlight: 'rgba(139, 92, 246, 0.16)',
    sparkStroke: '#8b5cf6',
    sparkFill: 'rgba(139, 92, 246, 0.12)',
    iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    iconColor: '#8b5cf6',
    shimmer: 'from-violet-400/0 via-violet-400/20 to-violet-400/0',
    rimBorder: 'group-hover:border-violet-500/40',
  },
};

/**
 * Pure SVG Sparkline Generator
 */
function MiniSparkline({ data, strokeColor, fillColor }: { data: number[]; strokeColor: string; fillColor: string }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 110;
  const height = 36;
  const padding = 3;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-24 h-9 overflow-visible transition-transform duration-300 group-hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-grad-${strokeColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Area fill under curve */}
      <path d={areaD} fill={`url(#spark-grad-${strokeColor.replace('#', '')})`} />
      {/* Crisp glowing line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
      />
      {/* Last pulse dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].split(',')[0]}
          cy={points[points.length - 1].split(',')[1]}
          r="2.5"
          fill={strokeColor}
          className="animate-pulse"
        />
      )}
    </svg>
  );
}

/**
 * Production-ready Ultra Modern Dashboard Card
 * Features:
 * 1. Physical mechanical click feedback (scale 0.98)
 * 2. Real-time cursor-following specular spotlight
 * 3. 1px hairline glass rim (specular bevel top)
 * 4. Ambient underglow aura
 * 5. Dynamic light sweep / shine animation
 * 6. Zero-pill unboxed trend and tabular numbers
 */
export const ModernDashboardCard: React.FC<ModernDashboardCardProps> = ({
  value,
  subValue,
  trendText,
  trendDirection = 'neutral',
  trendContext,
  icon,
  accent = 'indigo',
  sparklineData,
  status,
  badgeText,
  onClick,
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Smooth mouse tracking relative to card coordinate plane
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const styleConfig = ACCENT_STYLES[accent] || ACCENT_STYLES.indigo;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      dir="rtl"
      data-accent={accent}
      data-card="true"
      className={`
        group relative isolate select-none
        rounded-2xl
        transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)
        transform-gpu will-change-transform
        ${onClick ? 'cursor-pointer active:scale-[0.98] active:translate-y-0' : ''}
        hover:-translate-y-1.5
        ${className}
      `}
      style={{
        // Custom CSS variables for mouse coordinates
        ['--mouse-x' as string]: `${mousePos.x}px`,
        ['--mouse-y' as string]: `${mousePos.y}px`,
      }}
    >
      {/* ========================================================
          LAYER 0: Ambient Diffuse Halo Underglow
          Softly blooms outward on hover behind the card
         ======================================================== */}
      <div
        className="pointer-events-none absolute -inset-1 rounded-2xl opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100 -z-20"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${styleConfig.glow}, transparent 70%)`,
        }}
      />

      {/* ========================================================
          LAYER 1: Main Card Base Body (Frosted Glass & Depth)
         ======================================================== */}
      <div
        className={`
          relative h-full w-full overflow-hidden rounded-2xl
          bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
          border border-slate-200/90 dark:border-slate-800/90
          ${styleConfig.rimBorder}
          shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.02)]
          group-hover:shadow-[0_20px_35px_-10px_rgba(0,0,0,0.12),0_1px_3px_0_rgba(0,0,0,0.04)]
          transition-all duration-300
        `}
      >
        {/* ========================================================
            LAYER 2: Specular Top Bevel Hairline (Apple/Linear 1px Rim)
            Simulates a bevel edge catching light from above
           ======================================================== */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"
          aria-hidden="true"
        />

        {/* ========================================================
            LAYER 3: Interactive Spotlight Following Mouse Pointer
           ======================================================== */}
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(280px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), ${styleConfig.spotlight}, transparent 75%)`,
          }}
          aria-hidden="true"
        />

        {/* ========================================================
            LAYER 4: Micro Light Streak (Shine Sweep on Hover)
            Sweeps across diagonally when hovered
           ======================================================== */}
        <div
          className={`
            pointer-events-none absolute -top-1/2 -left-1/2 w-[200%] h-[200%]
            bg-gradient-to-r ${styleConfig.shimmer}
            opacity-0 group-hover:opacity-100
            transform -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%]
            transition-transform duration-1000 ease-out
          `}
          aria-hidden="true"
        />

        {/* ========================================================
            LAYER 5: Card Content Grid
           ======================================================== */}
        <div className="relative z-10 p-5 flex flex-col justify-between h-full">
          {/* Header Row: Icon & Status / Badge */}
          <div className="flex items-center justify-between mb-4">
            {/* Icon Well with ambient backlight */}
            {icon && (
              <div
                className={`
                  relative flex items-center justify-center
                  w-11 h-11 rounded-xl border
                  transition-all duration-300
                  group-hover:scale-110 group-hover:rotate-1
                  shadow-xs ${styleConfig.iconBg}
                `}
              >
                {/* Micro inner reflection in the icon well */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
                {icon}
              </div>
            )}

            {/* Status Beacon & Badge */}
            <div className="flex items-center gap-2">
              {status && (
                <span className="relative flex h-2.5 w-2.5" title="وضعیت برخط">
                  {status === 'active' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      status === 'active'
                        ? 'bg-emerald-500'
                        : status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                    }`}
                  />
                </span>
              )}

              {badgeText && (
                <span className="text-[11px] font-medium tracking-tight text-slate-500 dark:text-slate-400">
                  {badgeText}
                </span>
              )}
            </div>
          </div>

          {/* Metric Value & Optional Sparkline Row */}
          <div className="flex items-end justify-between gap-3 my-1">
            <div className="min-w-0">
              {/* Primary Value with Tabular Numbers */}
              <div
                className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 font-mono tabular-nums leading-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {value}
              </div>

              {/* Sub-value / Descriptor */}
              {subValue && (
                <div className="mt-1.5 text-xs font-normal text-slate-500 dark:text-slate-400 truncate">
                  {subValue}
                </div>
              )}
            </div>

            {/* Sparkline Graphic if provided */}
            {sparklineData && sparklineData.length > 1 && (
              <div className="shrink-0">
                <MiniSparkline
                  data={sparklineData}
                  strokeColor={styleConfig.sparkStroke}
                  fillColor={styleConfig.sparkFill}
                />
              </div>
            )}
          </div>

          {/* Footer Trend Row: Clean Unboxed Trend Badge */}
          {trendText && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium tabular-nums">
                {trendDirection === 'up' && (
                  <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                    <svg className="w-3.5 h-3.5 ms-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    {trendText}
                  </span>
                )}
                {trendDirection === 'down' && (
                  <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
                    <svg className="w-3.5 h-3.5 ms-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                    </svg>
                    {trendText}
                  </span>
                )}
                {trendDirection === 'neutral' && (
                  <span className="text-slate-500 dark:text-slate-400">{trendText}</span>
                )}

                {/* Inline separator and context */}
                {trendContext && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-slate-500 dark:text-slate-400 font-normal">{trendContext}</span>
                  </>
                )}
              </div>

              {/* Action arrow cue on hover */}
              {onClick && (
                <span className="text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:-translate-x-1 transition-all duration-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModernDashboardCard;
