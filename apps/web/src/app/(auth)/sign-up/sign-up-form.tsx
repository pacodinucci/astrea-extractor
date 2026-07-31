"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const result = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/library",
    });

    if (result.error) {
      setMessage(result.error.message ?? "No se pudo crear la cuenta.");
      setIsSubmitting(false);
      return;
    }

    setMessage("Cuenta creada. Redirigiendo...");
    router.push("/library");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Astrea Extractor</p>
        <h1>Crear cuenta</h1>
        <label>
          Nombre
          <input
            autoComplete="name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            type="text"
            value={name}
          />
        </label>
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
            autoComplete="new-password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creando..." : "Crear cuenta"}
        </button>
        {message ? <p className="form-message">{message}</p> : null}
        <a href="/sign-in">Ya tengo cuenta</a>
      </form>
    </main>
  );
}