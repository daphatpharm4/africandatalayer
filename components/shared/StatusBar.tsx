import React from 'react';

const StatusBar: React.FC = () => (
  <div
    aria-hidden="true"
    className="flex h-11 shrink-0 items-center justify-between bg-white px-5"
  >
    <span className="text-[15px] font-semibold text-ink-dark">9:41</span>
    <div className="flex items-center gap-1.5 text-ink-dark">
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
        <rect x="0" y="3" width="3" height="9" rx="1" />
        <rect x="4.5" y="2" width="3" height="10" rx="1" />
        <rect x="9" y="0.5" width="3" height="11.5" rx="1" />
        <rect x="13.5" y="0" width="2.5" height="12" rx="1" opacity="0.3" />
      </svg>
      <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor">
        <path d="M7.5 2.5C9.8 2.5 11.9 3.4 13.4 4.9L14.8 3.5C12.9 1.6 10.3 0.5 7.5 0.5C4.7 0.5 2.1 1.6 0.2 3.5L1.6 4.9C3.1 3.4 5.2 2.5 7.5 2.5Z" opacity="0.3" />
        <path d="M7.5 5.5C9 5.5 10.3 6.1 11.3 7.1L12.7 5.7C11.3 4.3 9.5 3.5 7.5 3.5C5.5 3.5 3.7 4.3 2.3 5.7L3.7 7.1C4.7 6.1 6 5.5 7.5 5.5Z" />
        <circle cx="7.5" cy="10" r="2" />
      </svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" strokeOpacity="0.35" />
        <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
        <path d="M23 4.5V7.5C23.8 7.2 24.5 6.4 24.5 6C24.5 5.6 23.8 4.8 23 4.5Z" fill="currentColor" opacity="0.4" />
      </svg>
    </div>
  </div>
);

export default React.memo(StatusBar);
