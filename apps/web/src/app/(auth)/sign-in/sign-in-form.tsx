"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/library",
    });

    if (result.error) {
      setMessage(result.error.message ?? "No se pudo iniciar sesión.");
      setIsSubmitting(false);
      return;
    }

    setMessage("Sesión iniciada. Redirigiendo...");
    router.push("/library");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Astrea Extractor</p>
        <h1>Ingresar</h1>
        <label>
          Email
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Contraseña
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </button>
        {message ? <p className="form-message">{message}</p> : null}
        <a href="/sign-up">Crear cuenta</a>
      </form>
    </main>
  );
}