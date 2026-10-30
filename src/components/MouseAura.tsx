import React, { useEffect, useState, useRef } from 'react';

// Color map for different card accents to RGB values for radial glow gradients
const ACCENT_RGB_MAP: Record<string, { primary: string; secondary: string; border: string }> = {
  emerald: {
    primary: 'rgba(16, 185, 129, 0.35)',
    secondary: 'rgba(52, 211, 153, 0.18)',
    border: 'rgba(16, 185, 129, 0.5)',
  },
  indigo: {
    primary: 'rgba(99, 102, 241, 0.35)',
    secondary: 'rgba(129, 140, 248, 0.18)',
    border: 'rgba(99, 102, 241, 0.5)',
  },
  rose: {
    primary: 'rgba(244, 63, 94, 0.35)',
    secondary: 'rgba(251, 113, 133, 0.18)',
    border: 'rgba(244, 63, 94, 0.5)',
  },
  amber: {
    primary: 'rgba(245, 158, 11, 0.35)',
    secondary: 'rgba(252, 211, 77, 0.18)',
    border: 'rgba(245, 158, 11, 0.5)',
  },
  cyan: {
    primary: 'rgba(6, 182, 212, 0.35)',
    secondary: 'rgba(103, 232, 249, 0.18)',
    border: 'rgba(6, 182, 212, 0.5)',
  },
  purple: {
    primary: 'rgba(168, 85, 247, 0.35)',
    secondary: 'rgba(216, 180, 254, 0.18)',
    border: 'rgba(168, 85, 247, 0.5)',
  },
  violet: {
    primary: 'rgba(139, 92, 246, 0.35)',
    secondary: 'rgba(196, 181, 253, 0.18)',
    border: 'rgba(139, 92, 246, 0.5)',
  },
  blue: {
    primary: 'rgba(59, 130, 246, 0.35)',
    secondary: 'rgba(147, 197, 253, 0.18)',
    border: 'rgba(59, 130, 246, 0.5)',
  },
  default: {
    primary: 'rgba(99, 102, 241, 0.22)',
    secondary: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(99, 102, 241, 0.3)',
  },
};

/**
 * MouseAura Component
 * Creates an interactive light aura that seamlessly follows the mouse across all app sections and cards.
 * When hovering over a card, it adapts its glow color to match the card theme and applies shiny specular highlights.
 */
export const MouseAura: React.FC = () => {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: -200, y: -200 });
  const [activeAccent, setActiveAccent] = useState<string>('default');
  const [isOverCard, setIsOverCard] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const requestRef = useRef<number | null>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: -200, y: -200 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);

      // Inspect target element or its ancestors to detect card accents & set card mouse CSS variables
      const target = e.target as HTMLElement | null;
      if (target) {
        // Find closest card container
        const cardEl = target.closest<HTMLElement>(
          '[data-accent], [data-card-accent], .group, [role="button"], .glass-card, [data-card]'
        );

        if (cardEl) {
          // Update relative mouse coordinates inside card
          const rect = cardEl.getBoundingClientRect();
          const relX = e.clientX - rect.left;
          const relY = e.clientY - rect.top;
          cardEl.style.setProperty('--mouse-x', `${relX}px`);
          cardEl.style.setProperty('--mouse-y', `${relY}px`);

          // Extract accent theme from data attribute or class name
          const attrAccent =
            cardEl.getAttribute('data-accent') ||
            cardEl.getAttribute('data-card-accent');

          let detectedAccent = 'indigo';
          if (attrAccent && ACCENT_RGB_MAP[attrAccent]) {
            detectedAccent = attrAccent;
          } else {
            // Sniff color classes from element if data attribute not explicitly set
            const classListStr = cardEl.className || '';
            if (classListStr.includes('rose') || classListStr.includes('pink')) detectedAccent = 'rose';
            else if (classListStr.includes('emerald') || classListStr.includes('teal') || classListStr.includes('green')) detectedAccent = 'emerald';
            else if (classListStr.includes('amber') || classListStr.includes('orange') || classListStr.includes('yellow')) detectedAccent = 'amber';
            else if (classListStr.includes('purple') || classListStr.includes('fuchsia')) detectedAccent = 'purple';
            else if (classListStr.includes('violet')) detectedAccent = 'violet';
            else if (classListStr.includes('cyan') || classListStr.includes('sky')) detectedAccent = 'cyan';
            else if (classListStr.includes('blue')) detectedAccent = 'blue';
            else if (classListStr.includes('indigo')) detectedAccent = 'indigo';
          }

          setActiveAccent(detectedAccent);
          setIsOverCard(true);
        } else {
          setIsOverCard(false);
          setActiveAccent('default');
        }
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    // Smooth animation frame loop for lag-free cursor tracking
    const updatePosition = () => {
      setPosition(prev => {
        const dx = posRef.current.x - prev.x;
        const dy = posRef.current.y - prev.y;
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return prev;
        return {
          x: prev.x + dx * 0.45,
          y: prev.y + dy * 0.45,
        };
      });
      requestRef.current = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    requestRef.current = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isVisible]);

  const colors = ACCENT_RGB_MAP[activeAccent] || ACCENT_RGB_MAP.default;

  if (!isVisible) return null;

  return (
    <>
      {/* 1. Global Ambient Light Halo (Follows mouse everywhere across background and sections) */}
      <div
        className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-300 overflow-hidden"
        style={{ opacity: isVisible ? 1 : 0 }}
        aria-hidden="true"
      >
        {/* Main outer diffuse bloom */}
        <div
          className="absolute rounded-full blur-3xl transition-all duration-300 ease-out transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: isOverCard ? '450px' : '380px',
            height: isOverCard ? '450px' : '380px',
            background: `radial-gradient(circle, ${colors.primary} 0%, ${colors.secondary} 45%, transparent 70%)`,
          }}
        />

        {/* Inner intense specular core highlight */}
        <div
          className="absolute rounded-full blur-xl transition-all duration-150 ease-out transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: isOverCard ? '160px' : '110px',
            height: isOverCard ? '160px' : '110px',
            background: `radial-gradient(circle, ${colors.border} 0%, ${colors.primary} 50%, transparent 80%)`,
          }}
        />
      </div>
    </>
  );
};

export default MouseAura;
