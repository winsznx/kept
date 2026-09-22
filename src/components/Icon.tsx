import type { ReactNode } from "react";

/**
 * Kept line icons. The first eight are the brand kit's product icons
 * (internal/kept-brand-kit-v1/ui-icons); the rest are drawn to the same 24px grid,
 * 1.8 stroke and round caps so the set reads as one family.
 */
const PATHS = {
  record: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  watch: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </>
  ),
  detect: (
    <>
      <path d="M12 3l9 16H3L12 3z" />
      <path d="M12 9v4M12 16h.01" />
    </>
  ),
  resolve: <path d="M20 6L9 17l-5-5" />,
  verify: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3z" />
      <path d="M8.5 12l2.2 2.2 4.8-5" />
    </>
  ),
  evidence: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v4h4M9 12h6M9 16h5" />
    </>
  ),
  promise: (
    <>
      <path d="M7 4h10v16H7z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
      <path d="M10 4V2h4v2" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  inbox: (
    <>
      <path d="M4 13l2.5-7h11L20 13" />
      <path d="M4 13v5a2 2 0 002 2h12a2 2 0 002-2v-5h-5l-1 2h-4l-1-2H4z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 16v3a1 1 0 001 1h12a1 1 0 001-1v-3" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 00-14.5-4.5L4 8" />
      <path d="M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="3" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  logout: (
    <>
      <path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
      <path d="M10 16l-4-4 4-4M6 12h10" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5l11 7-11 7V5z" />,
  quote: <path d="M9 7H6a1 1 0 00-1 1v4h4v4H5M19 7h-3a1 1 0 00-1 1v4h4v4h-4" />,
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6L5 19a1 1 0 001 1.5h12A1 1 0 0019 19l-5-10V3" />
      <path d="M7.5 15h9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ height = 28, variant = "primary" }: { height?: number; variant?: "primary" | "white" }) {
  return <img src={variant === "white" ? "/brand/kept-logo-mono-white.svg" : "/brand/kept-logo-primary.svg"} height={height} width={Math.round((height * 1260) / 556)} alt="Kept" style={{ display: "block" }} />;
}

export function Mark({ size = 28 }: { size?: number }) {
  return <img src="/brand/kept-mark-primary.svg" width={Math.round((size * 337) / 471)} height={size} alt="" aria-hidden="true" style={{ display: "block" }} />;
}
