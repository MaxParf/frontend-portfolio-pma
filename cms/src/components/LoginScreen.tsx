import { FormEvent, useId, useState } from "react";
import { ApiError } from "../api/client";

interface LoginScreenProps {
  apiBaseUrl: string;
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginScreen({ apiBaseUrl, onLogin }: LoginScreenProps) {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : "Unable to login.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__mark">M</div>
        <p className="login-panel__eyebrow">Owner access</p>
        <h1 id="login-title">Maxpar CMS</h1>
        <p className="login-panel__copy">Server-side authentication is required before the CMS shell or admin API can be opened.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            value={email}
            autoComplete="username"
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error ? errorId : undefined}
          />

          <label htmlFor={passwordId}>Password</label>
          <input
            id={passwordId}
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={error ? errorId : undefined}
          />

          {error ? (
            <p className="login-form__error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-panel__meta">API: {apiBaseUrl}</p>
      </section>
    </main>
  );
}
