import { FormEvent, useId, useState } from "react";
import { ApiError } from "../api/client";

interface LoginScreenProps {
  apiBaseUrl: string;
  onLogin: (login: string, password: string) => Promise<void>;
}

export function LoginScreen({ apiBaseUrl, onLogin }: LoginScreenProps) {
  const loginId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!login || !password) {
      setError("Login and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      await onLogin(login, password);
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
          <label htmlFor={loginId}>Login</label>
          <input
            id={loginId}
            type="text"
            value={login}
            autoComplete="username"
            onChange={(event) => setLogin(event.target.value)}
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
