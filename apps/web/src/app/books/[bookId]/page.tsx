import { getBookById, searchBookPages } from "@astrea/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

type BookDetailPageProps = {
  params: Promise<{
    bookId: string;
  }>;
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function BookDetailPage({ params, searchParams }: BookDetailPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { bookId } = await params;
  const { q } = await searchParams;
  const book = await getBookById(bookId);

  if (!book) {
    notFound();
  }

  const readyPages = book.pages.filter((page) => page.status === "ready").length;
  const failedPageRecords = book.pages.filter((page) => page.status === "failed");
  const failedPages = failedPageRecords.length;
  const searchResults = q ? await searchBookPages(book.id, q) : [];

  return (
    <main className="page">
      <section className="hero library-section">
        <p className="eyebrow">Libro</p>
        <h1>{book.title ?? `Libro ${book.astreaBookId}`}</h1>
        <p>
          ID Astrea: <strong>{book.astreaBookId}</strong> · Estado: <strong>{book.status}</strong>
        </p>
        <div className="metadata-grid">
          <MetadataItem label="Autor" value={book.author} />
          <MetadataItem label="Edición" value={book.edition} />
          <MetadataItem label="Páginas totales" value={book.totalPages?.toString()} />
          <MetadataItem label="Páginas listas" value={readyPages.toString()} />
          <MetadataItem label="Páginas fallidas" value={failedPages.toString()} />
        </div>

        {book.status === "partial" ? (
          <div className="partial-warning">
            <strong>Extracción parcial</strong>
            <p>
              Este libro tiene páginas fallidas. Podés descargar el TXT parcial
              y revisar abajo qué páginas requieren reintento.
            </p>
          </div>
        ) : null}

        <p>
          <a className="button-link" href={`/books/${book.id}/download`}>
            Descargar TXT{book.status === "partial" ? " parcial" : ""}
          </a>
        </p>

        <form className="inline-form">
          <label>
            Buscar en este libro
            <input defaultValue={q} name="q" placeholder="Palabra o frase" />
          </label>
          <button type="submit">Buscar</button>
        </form>

        {q ? (
          <div className="search-results">
            <h2>Resultados para “{q}”</h2>
            {searchResults.length === 0 ? (
              <p className="muted">No se encontraron coincidencias.</p>
            ) : (
              <ol className="book-list">
                {searchResults.map((result) => (
                  <li key={`${result.bookId}-${result.pageNumber}`}>
                    <strong>Página {result.pageNumber}</strong>
                    <p>{result.snippet}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </section>

      {failedPageRecords.length > 0 ? (
        <section className="content-section">
          <h2>Páginas fallidas</h2>
          <ol className="book-list danger-list">
            {failedPageRecords.map((page) => (
              <li key={page.id}>
                <strong>Página {page.pageNumber}</strong>
                <span>{page.errorMessage ?? "Sin detalle de error."}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="content-section split-section">
        <article>
          <h2>Capítulos</h2>
          {book.chapters.length === 0 ? (
            <p className="muted">Todavía no hay capítulos detectados.</p>
          ) : (
            <ol className="book-list">
              {book.chapters.map((chapter) => (
                <li key={chapter.id}>
                  <strong>{chapter.title}</strong>
                  <span>
                    Páginas {chapter.startPage ?? "?"} - {chapter.endPage ?? "?"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article>
          <h2>Páginas</h2>
          {book.pages.length === 0 ? (
            <p className="muted">Todavía no hay páginas procesadas.</p>
          ) : (
            <ol className="book-list">
              {book.pages.map((page) => (
                <li key={page.id}>
                  <strong>Página {page.pageNumber}</strong>
                  <span>Estado: {page.status}</span>
                  {page.text ? <p>{page.text.slice(0, 220)}...</p> : null}
                  {page.errorMessage ? <p>Error: {page.errorMessage}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>
    </main>
  );
}

function MetadataItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || "Pendiente"}</strong>
    </div>
  );
}