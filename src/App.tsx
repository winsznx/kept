import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router";
import { AppShell, SiteLayout } from "./components/Layouts";
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

function Loading() {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" /> Loading…
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="signIn" />} />
          <Route path="/signup" element={<AuthPage mode="signUp" />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/proof" element={<Proof />} />
          <Route path="/proof/run/:runId" element={<ProofRun />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="/app" element={<AppHome />} />
          <Route path="/app/protect" element={<Protect />} />
          <Route path="/app/items/:itemId" element={<ItemDetail />} />
          <Route path="/app/items/:itemId/evidence" element={<ItemEvidence />} />
          <Route path="/app/items/:itemId/timeline" element={<ItemTimeline />} />
          <Route path="/app/cases/:caseId" element={<CaseDetail />} />
          <Route path="/app/inbox" element={<Inbox />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="container page">
      <div className="page-head">
        <span className="eyebrow">404</span>
        <h1>This page isn’t here.</h1>
        <p>
          <Link to="/" className="btn">
            Go home
          </Link>
        </p>
      </div>
    </div>
  );
}
