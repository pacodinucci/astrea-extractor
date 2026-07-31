export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Astrea Extractor</p>
        <h1>Biblioteca documental compartida</h1>
        <p>
          Webapp para solicitar libros, seguir su procesamiento y descargar el
          texto extraído cuando esté disponible.
        </p>
        <p>
          <a href="/sign-in">Ingresar</a> · <a href="/sign-up">Crear cuenta</a> ·{" "}
          <a href="/library">Biblioteca</a> · <a href="/jobs">Jobs</a>
        </p>
      </section>
    </main>
  );
}