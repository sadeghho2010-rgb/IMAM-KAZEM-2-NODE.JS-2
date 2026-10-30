import React, { useState, useRef } from 'react';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  accentColor?: string;
  glowRadius?: number;
  dataAccent?: string;
}

/**
 * SpotlightCard Component
 * Implements the interactive Spotlight Beam halo effect.
 * Tracks local mouse coordinates on hover and renders a smooth radial gradient halo.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  accentColor = 'rgba(99, 102, 241, 0.22)',
  glowRadius = 280,
  dataAccent,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-accent={dataAccent}
      data-card="true"
      className={`relative overflow-hidden transition-all duration-300 ${className}`}
      {...props}
    >
      {/* Spotlight Beam Light Layer */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200 z-10"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${glowRadius}px circle at ${mousePos.x}px ${mousePos.y}px, ${accentColor}, transparent 75%)`,
        }}
        aria-hidden="true"
      />

      {/* Card Content Layer */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
};

export default SpotlightCard;
