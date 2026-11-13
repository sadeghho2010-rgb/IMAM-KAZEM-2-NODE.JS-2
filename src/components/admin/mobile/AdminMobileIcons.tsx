import React from 'react';

export interface AdminGlyphProps {
  size?: number;
  className?: string;
  active?: boolean;
}

export const GlyphAdminHome: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 10.5L12 4L20 10.5V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V10.5Z"
      fill="currentColor"
      fillOpacity={active ? 0.24 : 0.12}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M9.5 21V14.5C9.5 13.7 10.2 13 11 13H13C13.8 13 14.5 13.7 14.5 14.5V21" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const GlyphActiveStudents: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="9.5" cy="8" r="3.5" fill="currentColor" fillOpacity={active ? 0.28 : 0.14} stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 19.5C3.5 16.5 6.2 14.5 9.5 14.5C12.8 14.5 15.5 16.5 15.5 19.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16 11.5L17.8 13.3L21 9.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GlyphProgramsBook: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3.5" fill="currentColor" fillOpacity={active ? 0.24 : 0.12} stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 9.5H20" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 3V6M15 3V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.5 13.5H15.5M8.5 16.5H13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const GlyphAttendanceShield: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity={active ? 0.24 : 0.12} stroke="currentColor" strokeWidth="1.8" />
    <path d="M8.5 12.2L11 14.7L15.8 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GlyphStudyAnalytics: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="12" width="4" height="8" rx="1.2" fill="currentColor" fillOpacity={active ? 0.35 : 0.18} stroke="currentColor" strokeWidth="1.7" />
    <rect x="10" y="7" width="4" height="13" rx="1.2" fill="currentColor" fillOpacity={active ? 0.45 : 0.22} stroke="currentColor" strokeWidth="1.7" />
    <rect x="16" y="4" width="4" height="16" rx="1.2" fill="currentColor" fillOpacity={active ? 0.35 : 0.18} stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const GlyphTeachersCap: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 4L2.5 9L12 14L21.5 9L12 4Z" fill="currentColor" fillOpacity={active ? 0.28 : 0.14} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M6 11.2V16.2C6 17.8 8.7 19.5 12 19.5C15.3 19.5 18 17.8 18 16.2V11.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M20.5 10V15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const GlyphRequestsInbox: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M4 13L6.2 5.5C6.5 4.6 7.3 4 8.2 4H15.8C16.7 4 17.5 4.6 17.8 5.5L20 13V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V13Z" fill="currentColor" fillOpacity={active ? 0.24 : 0.12} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4 13H8.8L10.3 15.2H13.7L15.2 13H20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export const GlyphWorkflowFlow: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <circle cx="7" cy="6" r="2.5" fill="currentColor" fillOpacity={active ? 0.3 : 0.15} stroke="currentColor" strokeWidth="1.8" />
    <circle cx="7" cy="18" r="2.5" fill="currentColor" fillOpacity={active ? 0.3 : 0.15} stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17" cy="12" r="2.5" fill="currentColor" fillOpacity={active ? 0.3 : 0.15} stroke="currentColor" strokeWidth="1.8" />
    <path d="M7 8.5V15.5M9.2 6.8C13 7.5 14.8 9.2 15.3 10.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const GlyphFinanceCoins: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <ellipse cx="10" cy="7.5" rx="6" ry="3" fill="currentColor" fillOpacity={active ? 0.28 : 0.14} stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 7.5V16.5C4 18.2 6.7 19.5 10 19.5C13.3 19.5 16 18.2 16 16.5V7.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 12C4 13.7 6.7 15 10 15C13.3 15 16 13.7 16 12" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="18" cy="16" r="3" fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const GlyphSecurityLock: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 3.5L19 6.5V12C19 16.5 15.8 19.8 12 21C8.2 19.8 5 16.5 5 12V6.5L12 3.5Z" fill="currentColor" fillOpacity={active ? 0.26 : 0.13} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 10.5V14.5M12 8.2H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const GlyphAllModules: React.FC<AdminGlyphProps> = ({ size = 20, className = '', active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4" y="4" width="6.5" height="6.5" rx="2" fill="currentColor" fillOpacity={active ? 0.34 : 0.16} stroke="currentColor" strokeWidth="1.8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" fill="currentColor" fillOpacity={active ? 0.2 : 0.1} stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" fill="currentColor" fillOpacity={active ? 0.2 : 0.1} stroke="currentColor" strokeWidth="1.8" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" fill="currentColor" fillOpacity={active ? 0.34 : 0.16} stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
