import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const IconFridge = (p: P) => (<svg {...base} {...p}><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><path d="M5 9.5h14M8.5 5.5v1.5M8.5 12.5v3" /></svg>);
export const IconBook = (p: P) => (<svg {...base} {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></svg>);
export const IconScan = (p: P) => (<svg {...base} strokeWidth={2} {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7.5 12h9" /></svg>);
export const IconChef = (p: P) => (<svg {...base} {...p}><path d="M7 14.5V20h10v-5.5M7 14.5a4 4 0 0 1-.9-7.9 5 5 0 0 1 9.8 0 4 4 0 0 1-.9 7.9z" /><path d="M7 17h10" /></svg>);
export const IconMore = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
export const IconPlus = (p: P) => (<svg {...base} strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconBack = (p: P) => (<svg {...base} strokeWidth={2.2} {...p}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconCamera = (p: P) => (<svg {...base} {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const IconImage = (p: P) => (<svg {...base} {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8 8.5" /></svg>);
export const IconSpark = (p: P) => (<svg {...base} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>);
export const IconGlobe = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
export const IconTimer = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2.5h6" /></svg>);
export const IconCheck = (p: P) => (<svg {...base} strokeWidth={2.6} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconSync = (p: P) => (<svg {...base} {...p}><path d="M20 8a8 8 0 0 0-14.5-2M4 16a8 8 0 0 0 14.5 2" /><path d="M20 3v5h-5M4 21v-5h5" /></svg>);
export const IconCart = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="17" cy="20" r="1.5" />
    <path d="M2.5 3.5h3l2.2 11.2a1.8 1.8 0 0 0 1.8 1.3h8.8a1.8 1.8 0 0 0 1.8-1.4l1.4-7.1H6.2" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" />
  </svg>
);
export const IconCal = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
    <path d="M16 2.5v4M8 2.5v4M3.5 9.5h17" />
  </svg>
);
export const IconLock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const IconUnlock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.8-1.2" />
  </svg>
);
export const IconSwap = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);
