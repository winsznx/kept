import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { Icon, Mark } from "../components/Icon";

export default function AuthPage({ mode }: { mode: "signIn" | "signUp" }) {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isAuthenticated) return <Navigate to="/app" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);
    try {
      await signIn("password", formData);
    } catch {
      setError(
        mode === "signIn"
          ? "That email and password didn’t match an account."
          : "Couldn’t create the account. The email may already be registered, or the password is shorter than 8 characters.",
      );
    } finally {
      setPending(false);
    }
  }

  const title = mode === "signIn" ? "Sign in" : "Create your Kept account";
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="stack" style={{ gap: 14 }}>
          <Mark size={34} />
          <h1>{title}</h1>
          <p className="muted small">{mode === "signIn" ? "Welcome back. Your promises are where you left them." : "Get your own Kept inbox and start recording what you were promised."}</p>
        </div>
        <form className="stack" style={{ gap: 14 }} onSubmit={(e) => void onSubmit(e)} noValidate aria-describedby={error ? "auth-error" : undefined}>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} minLength={8} required />
          </label>
          {error ? (
            <p id="auth-error" className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {pending ? <span className="spinner" /> : null}
            {pending ? "Working…" : title}
          </button>
        </form>
        <p className="small muted" style={{ textAlign: "center" }}>
          {mode === "signIn" ? (
            <>
              New to Kept? <Link to="/signup" style={{ color: "var(--ink)", fontWeight: 600 }}>Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login" style={{ color: "var(--ink)", fontWeight: 600 }}>Sign in</Link>
            </>
          )}
        </p>
        <Link to="/demo" className="inner-pill">
          <Icon name="play" size={15} /> Or try the demo without an account
        </Link>
      </div>
    </div>
  );
}
