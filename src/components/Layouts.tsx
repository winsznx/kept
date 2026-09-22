import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Icon, Logo, type IconName } from "./Icon";

const SITE_NAV = [
  { to: "/#loop", label: "How it works" },
  { to: "/demo", label: "Live demo" },
  { to: "/proof", label: "Proof" },
  { to: "/#faq", label: "FAQ" },
];

const FOOTER = [
  {
    heading: "Product",
    links: [
      { to: "/demo", label: "Live demo" },
      { to: "/signup", label: "Protect a plan" },
      { to: "/how-it-works", label: "How it works" },
    ],
  },
  {
    heading: "Evidence",
    links: [
      { to: "/proof", label: "Proof runs" },
      { to: "https://github.com/winsznx/kept/blob/main/evidence/campaign-report.md", label: "Campaign report" },
      { to: "https://github.com/winsznx/kept", label: "Source code" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/privacy", label: "Privacy" },
      { to: "/login", label: "Sign in" },
    ],
  },
];

export function SiteLayout() {
  const { isAuthenticated } = useConvexAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className="site">
      <a href="#main" className="sr-only skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" aria-label="Kept home" onClick={() => setOpen(false)}>
            <Logo height={30} />
          </Link>
          <nav className="site-nav" aria-label="Main">
            {SITE_NAV.map((n) => (
              <Link key={n.to} to={n.to} aria-current={location.pathname === n.to ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="site-actions">
            {isAuthenticated ? (
              <Link to="/app" className="btn btn-primary">
                Open app <Icon name="arrowRight" size={16} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="site-login">
                  Sign in
                </Link>
                <Link to="/signup" className="btn btn-primary">
                  Protect a plan
                </Link>
              </>
            )}
            <button type="button" className="icon-btn site-menu-button" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
              <Icon name={open ? "close" : "menu"} size={18} />
            </button>
          </div>
        </div>
        <nav id="site-menu" className="site-mobile-menu" data-open={open} aria-label="Mobile">
          {[...SITE_NAV, ...(isAuthenticated ? [{ to: "/app", label: "Open app" }] : [{ to: "/login", label: "Sign in" }, { to: "/signup", label: "Protect a plan" }])].map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>
              {n.label} <Icon name="chevronRight" size={16} />
            </Link>
          ))}
        </nav>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer container">
        <div className="footer-grid">
          <div>
            <Logo height={28} />
            <p style={{ maxWidth: 300 }}>Kept remembers the deal you bought, checks every bill against it, and verifies the fix.</p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.heading}>
              <h3>{col.heading}</h3>
              {col.links.map((l) =>
                l.to.startsWith("http") ? (
                  <a key={l.to} href={l.to} target="_blank" rel="noopener noreferrer">
                    {l.label} <Icon name="arrowUpRight" size={13} />
                  </a>
                ) : (
                  <Link key={l.to} to={l.to}>
                    {l.label}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Kept · Compares evidence, not legal advice.</span>
          <span>Record the promise. Catch the drift. Verify the fix.</span>
        </div>
      </footer>
    </div>
  );
}

const APP_NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/app", label: "My plans", icon: "home", end: true },
  { to: "/app/protect", label: "Protect a plan", icon: "plus" },
  { to: "/app/inbox", label: "Kept inbox", icon: "inbox" },
  { to: "/demo", label: "Live demo", icon: "play" },
  { to: "/proof", label: "Proof", icon: "verify" },
];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  if (isLoading)
    return (
      <div className="loading-block" role="status">
        <span className="spinner" /> Checking your session…
      </div>
    );
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export type Crumb = { label: string; to?: string };

export function AppShell() {
  const me = useQuery(api.workspaces.me);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const email = me?.email ?? "";
  return (
    <RequireAuth>
      <div className="app-shell">
        <a href="#main" className="sr-only skip-link">
          Skip to content
        </a>
        <aside className="app-rail" aria-label="App">
          <div>
            <Link to="/" className="app-rail-logo" aria-label="Kept website">
              <Logo height={28} />
            </Link>
            <div className="app-account">
              <span className="app-avatar" aria-hidden="true">
                {email ? email[0] : "K"}
              </span>
              <div style={{ minWidth: 0 }}>
                <strong>{email || "Your account"}</strong>
                <span>{me?.inboxStatus === "READY" ? "Kept inbox ready" : me?.inboxStatus === "UNAVAILABLE" ? "Upload or paste evidence" : "Setting up inbox…"}</span>
              </div>
            </div>
            <nav className="app-nav" aria-label="Main">
              {APP_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>
                  <Icon name={n.icon} size={19} />
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="app-rail-create">
              <Link to="/app/protect" className="btn btn-primary">
                <Icon name="plus" size={16} /> Protect a plan
              </Link>
            </div>
          </div>
          <div>
            <div className="app-help">
              <span className="icon-tile is-soft" aria-hidden="true">
                <Icon name="email" size={17} />
              </span>
              <strong>Forward once.</strong>
              <p>Send the signup email to your Kept inbox. Kept records the promise and checks every later bill.</p>
              <Link to="/app/inbox">
                Open inbox <Icon name="arrowUpRight" size={14} />
              </Link>
            </div>
            <button
              type="button"
              className="app-rail-link"
              onClick={() => {
                void signOut().then(() => navigate("/"));
              }}
            >
              <Icon name="logout" size={19} /> Sign out
            </button>
            <div className="app-rail-foot">Kept compares evidence. It doesn’t give legal advice.</div>
          </div>
        </aside>
        <div className="app-workspace">
          <main id="main" style={{ display: "contents" }}>
            <Outlet />
          </main>
        </div>
        <nav className="app-mobile-nav" aria-label="Mobile">
          {APP_NAV.slice(0, 4).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <Icon name={n.icon} size={20} />
              {n.label.replace("Protect a plan", "Protect").replace("Kept inbox", "Inbox").replace("Live demo", "Demo")}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => navigate("/"));
            }}
          >
            <Icon name="logout" size={20} />
            Sign out
          </button>
        </nav>
      </div>
    </RequireAuth>
  );
}

/** Top bar for an app page: back/forward, breadcrumb trail, and a trailing action slot. */
export function TopBar({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="app-topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        <span className="crumb-back">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <button type="button" aria-label="Forward" onClick={() => navigate(1)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </span>
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="row" style={{ gap: 10 }}>
            {i > 0 ? (
              <span className="sep" aria-hidden="true">
                /
              </span>
            ) : null}
            {c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="app-topbar-actions">{actions}</div>
    </header>
  );
}
