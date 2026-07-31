import { listBooks } from "@astrea/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestIngestionAction } from "./actions";

type LibraryPageProps = {
  searchParams: Promise<{
    error?: string;
    status?: string;
    bookId?: string;
    jobId?: string;
  }>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const books = await listBooks();

  return (
    <main className="page">
      <section className="hero library-section">
        <p className="eyebrow">Biblioteca</p>
        <h1>Libros procesados</h1>
        <p>
          Solicitá un libro por ID de Astrea. Si ya fue procesado, vas a usar el
          texto existente; si no, queda en cola para procesamiento serial.
        </p>

        <form className="inline-form" action={requestIngestionAction}>
          <label>
            ID de Astrea
            <input name="astreaBookId" placeholder="Ej: 12345" required />
          </label>
          <button type="submit">Solicitar libro</button>
        </form>

        <LibraryMessage {...params} />
      </section>

      <section className="content-section">
        <h2>Biblioteca común</h2>
        {books.length === 0 ? (
          <p className="muted">Todavía no hay libros registrados.</p>
        ) : (
          <ul className="book-list">
            {books.map((book) => (
              <li key={book.id}>
                <a href={`/books/${book.id}`}><strong>{book.title ?? `Libro ${book.astreaBookId}`}</strong></a>
                <span>ID Astrea: {book.astreaBookId}</span>
                <span>Estado: {book.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function LibraryMessage({ error, status, bookId, jobId }: Awaited<LibraryPageProps["searchParams"]>) {
  if (error === "missing-book-id") {
    return <p className="form-message">Ingresá un ID de Astrea válido.</p>;
  }

  if (status === "available") {
    return <p className="form-message">El libro ya estaba disponible: {bookId}.</p>;
  }

  if (status === "processing") {
    return <p className="form-message">El libro ya está en proceso. Job: {jobId}.</p>;
  }

  if (status === "queued") {
    return <p className="form-message">Libro encolado correctamente. Job: {jobId}.</p>;
  }

  return null;
}