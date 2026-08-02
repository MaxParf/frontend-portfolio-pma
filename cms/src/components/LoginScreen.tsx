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
      setError("Введите логин и пароль.");
      return;
    }

    setSubmitting(true);
    try {
      await onLogin(login, password);
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : "Не удалось выполнить вход.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <h1 id="login-title" className="visually-hidden">Вход в CMS</h1>
        <p className="login-panel__eyebrow">Доступ владельца</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor={loginId}>Логин</label>
          <input
            id={loginId}
            type="text"
            value={login}
            autoComplete="username"
            onChange={(event) => setLogin(event.target.value)}
            aria-describedby={error ? errorId : undefined}
          />

          <label htmlFor={passwordId}>Пароль</label>
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
            {submitting ? "Выполняется вход..." : "Войти"}
          </button>
        </form>

      </section>
    </main>
  );
}
