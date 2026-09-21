import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router";

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
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1>{title}</h1>
      <form className="stack" onSubmit={(e) => void onSubmit(e)} noValidate aria-describedby={error ? "auth-error" : undefined}>
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
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Working…" : title}
        </button>
      </form>
      {mode === "signIn" ? (
        <p>
          New to Kept? <Link to="/signup">Create an account</Link>
        </p>
      ) : (
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      )}
    </div>
  );
}
