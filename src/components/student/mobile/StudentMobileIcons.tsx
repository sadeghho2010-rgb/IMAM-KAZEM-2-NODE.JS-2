import React from 'react';

export interface MobileGlyphProps {
  size?: number;
  className?: string;
  active?: boolean;
}

export const GlyphHome: React.FC<MobileGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3.5 10.2L12 3.2L20.5 10.2V19.2C20.5 20.1 19.8 20.8 18.9 20.8H5.1C4.2 20.8 3.5 20.1 3.5 19.2V10.2Z"
      fill="currentColor"
      fillOpacity={active ? 0.2 : 0.08}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 20.8V14.5C9.5 13.7 10.2 13 11 13H13C13.8 13 14.5 13.7 14.5 14.5V20.8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="8.5" r="1.1" fill="currentColor" />
  </svg>
);

export const GlyphStudyBook: React.FC<MobileGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 6.2C10.2 4.8 7.5 4.2 4.5 4.5C3.9 4.6 3.5 5 3.5 5.6V17.4C3.5 18 4 18.5 4.6 18.4C7.5 18.1 10.1 18.7 12 20C13.9 18.7 16.5 18.1 19.4 18.4C20 18.5 20.5 18 20.5 17.4V5.6C20.5 5 20.1 4.6 19.5 4.5C16.5 4.2 13.8 4.8 12 6.2Z"
      fill="currentColor"
      fillOpacity={active ? 0.22 : 0.08}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M12 6.2V19.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M6.5 9.2H9.3M6.5 12.6H9.3M14.7 9.2H17.5M14.7 12.6H17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const GlyphAttendanceCheck: React.FC<MobileGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="5"
      fill="currentColor"
      fillOpacity={active ? 0.22 : 0.08}
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M8 12.3L10.8 15.1L16.3 9.2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const GlyphScheduleGrid: React.FC<MobileGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.5"
      y="5"
      width="17"
      height="15.5"
      rx="4"
      fill="currentColor"
      fillOpacity={active ? 0.2 : 0.08}
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path d="M3.5 9.8H20.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8.2 3.3V6.3M15.8 3.3V6.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="7" y="12.5" width="3" height="2.4" rx="0.8" fill="currentColor" />
    <rect x="11.5" y="12.5" width="5.5" height="2.4" rx="0.8" fill="currentColor" fillOpacity="0.6" />
    <rect x="7" y="16" width="5.5" height="2.1" rx="0.8" fill="currentColor" fillOpacity="0.6" />
  </svg>
);

export const GlyphAllServices: React.FC<MobileGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect
      x="3.5"
      y="3.5"
      width="7.4"
      height="7.4"
      rx="2.3"
      fill="currentColor"
      fillOpacity={active ? 0.28 : 0.12}
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="13.1"
      y="3.5"
      width="7.4"
      height="7.4"
      rx="2.3"
      fill="currentColor"
      fillOpacity="0.06"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="3.5"
      y="13.1"
      width="7.4"
      height="7.4"
      rx="2.3"
      fill="currentColor"
      fillOpacity="0.06"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <rect
      x="13.1"
      y="13.1"
      width="7.4"
      height="7.4"
      rx="3.7"
      fill="currentColor"
      fillOpacity={active ? 0.3 : 0.16}
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

/* --- 4 Core Hero Action Card Glyphs --- */

export const GlyphStudyOrbit: React.FC<MobileGlyphProps> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 6.5C10.1 5 7.4 4.4 4.6 4.7C4 4.8 3.6 5.2 3.6 5.8V17.4C3.6 18 4.1 18.5 4.7 18.4C7.5 18.1 10.1 18.7 12 20C13.9 18.7 16.5 18.1 19.3 18.4C19.9 18.5 20.4 18 20.4 17.4V5.8C20.4 5.2 20 4.8 19.4 4.7C16.6 4.4 13.9 5 12 6.5Z"
      fill="currentColor"
      fillOpacity="0.22"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M12 6.5V19.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M17.5 2.5L18.2 4.3L20 5L18.2 5.7L17.5 7.5L16.8 5.7L15 5L16.8 4.3L17.5 2.5Z" fill="currentColor" />
  </svg>
);

export const GlyphRequestPaperPlane: React.FC<MobileGlyphProps> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M20.6 3.9L3.8 10.6C3.1 10.9 3.1 11.9 3.9 12.2L9.8 14.3L12.1 20.1C12.4 20.9 13.4 20.9 13.7 20.2L20.6 3.9Z"
      fill="currentColor"
      fillOpacity="0.22"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M9.8 14.3L20.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="6.2" cy="17.8" r="1.3" fill="currentColor" fillOpacity="0.7" />
  </svg>
);

export const GlyphSelfReportSpark: React.FC<MobileGlyphProps> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M8.5 12.4L10.9 14.8L15.8 9.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M18.8 3.2L19.4 4.8L21 5.4L19.4 6L18.8 7.6L18.2 6L16.6 5.4L18.2 4.8L18.8 3.2Z" fill="currentColor" />
  </svg>
);

export const GlyphRepShieldCrown: React.FC<MobileGlyphProps> = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 3.2L19.5 6.2V11.8C19.5 16.3 16.3 19.8 12 21C7.7 19.8 4.5 16.3 4.5 11.8V6.2L12 3.2Z"
      fill="currentColor"
      fillOpacity="0.22"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9 12.1L11.1 14.2L15.4 9.9"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* --- Secondary Service Icons --- */

export const GlyphReportCard: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="3.5" width="16" height="17" rx="3.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 14.5V11.5M12 14.5V8.5M16 14.5V10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 17.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const GlyphCalendarTimeline: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="4" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 9.8H20.5M8.3 3.2V6.3M15.7 3.2V6.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="14.8" r="2.1" fill="currentColor" />
  </svg>
);

export const GlyphDiningBowl: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 12.2H20C20 16.5 16.5 19.6 12 19.6C7.5 19.6 4 16.5 4 12.2Z"
      fill="currentColor"
      fillOpacity="0.16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M8 8.8C8 7.5 9 7.2 9 6M12 8.8C12 7.2 13 6.8 13 5.5M16 8.8C16 7.5 17 7.2 17 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const GlyphWalletVault: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3.5" y="6" width="17" height="13" rx="3.5" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.8" />
    <path d="M6.5 6V5.3C6.5 4.2 7.4 3.5 8.5 3.5H16.5C17.4 3.5 18 4.2 18 5V6" stroke="currentColor" strokeWidth="1.6" />
    <rect x="14.5" y="10.8" width="6" height="3.6" rx="1.4" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const GlyphDiscussionGroup: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="9.2" cy="8.5" r="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="15.8" cy="9.5" r="2.4" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4.2 18.8C4.4 15.8 6.6 14 9.2 14C11.8 14 14 15.8 14.2 18.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M14.8 14.3C17 14.5 19.1 16 19.5 18.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const GlyphCourseSelect: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 9.2H16M8 12.6H11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M12.5 15.5L14.2 17.2L17.4 13.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GlyphGraduationScroll: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 4.5L21 9L12 13.5L3 9L12 4.5Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M6.5 11.2V16C6.5 17.6 9 19 12 19C15 19 17.5 17.6 17.5 16V11.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M20 9.6V15.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const GlyphResearchQuill: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M19.5 4.2C14.2 4.5 9.8 7.6 7.8 13.2L6.5 17.8L11.1 16.5C16.7 14.5 19.8 10.1 19.5 4.2Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4.5 19.8L13.5 10.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const GlyphPersonalTasks: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 9.2L9.4 10.6L11.6 8.2M13.5 9.4H16.5M8 14.8L9.4 16.2L11.6 13.8M13.5 15H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GlyphSecurityKey: React.FC<MobileGlyphProps> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="8.8" cy="12" r="4.2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.8" />
    <path d="M13 12H20.5V14.8M17.5 12V14.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8.3" cy="12" r="1.1" fill="currentColor" />
  </svg>
);
