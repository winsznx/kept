import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { Landing } from "./routes/Landing";

const AuthPage = lazy(() => import("./routes/AuthPage"));
const AppHome = lazy(() => import("./routes/AppHome"));
const Protect = lazy(() => import("./routes/Protect"));
const ItemDetail = lazy(() => import("./routes/ItemDetail"));
const ItemEvidence = lazy(() => import("./routes/ItemEvidence"));
const ItemTimeline = lazy(() => import("./routes/ItemTimeline"));
const CaseDetail = lazy(() => import("./routes/CaseDetail"));
const Inbox = lazy(() => import("./routes/Inbox"));
const Demo = lazy(() => import("./routes/Demo"));
const HowItWorks = lazy(() => import("./routes/HowItWorks"));
const Privacy = lazy(() => import("./routes/Privacy"));
const Proof = lazy(() => import("./routes/Proof"));
const ProofRun = lazy(() => import("./routes/ProofRun"));

function Header() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand">
          Kept
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/demo">Demo</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          {isAuthenticated ? (
            <>
              <NavLink to="/app" end>
                My plans
              </NavLink>
              <NavLink to="/app/inbox">Inbox</NavLink>
              <button type="button" className="btn" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <Link to="/signup" className="btn btn-primary">
                Protect a plan
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  if (isLoading) return <p role="status">Checking your session…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <div className="container">
          <Suspense fallback={<p role="status">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage mode="signIn" />} />
              <Route path="/signup" element={<AuthPage mode="signUp" />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/proof" element={<Proof />} />
              <Route path="/proof/run/:runId" element={<ProofRun />} />
              <Route path="/app" element={<RequireAuth><AppHome /></RequireAuth>} />
              <Route path="/app/protect" element={<RequireAuth><Protect /></RequireAuth>} />
              <Route path="/app/items/:itemId" element={<RequireAuth><ItemDetail /></RequireAuth>} />
              <Route path="/app/items/:itemId/evidence" element={<RequireAuth><ItemEvidence /></RequireAuth>} />
              <Route path="/app/items/:itemId/timeline" element={<RequireAuth><ItemTimeline /></RequireAuth>} />
              <Route path="/app/cases/:caseId" element={<RequireAuth><CaseDetail /></RequireAuth>} />
              <Route path="/app/inbox" element={<RequireAuth><Inbox /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      <footer className="site-footer">
        <div className="container row">
          <span>Kept compares evidence. It does not give legal advice.</span>
          <Link to="/privacy">Privacy</Link>
          <Link to="/proof">Proof</Link>
        </div>
      </footer>
    </>
  );
}

function NotFound() {
  return (
    <div className="stack">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </div>
  );
}
