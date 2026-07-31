import type { TxtExportDocument } from "./contracts";

export function buildTxtExport(document: TxtExportDocument) {
  const { metadata, chapters, pages } = document;
  const lines: string[] = [];

  lines.push("ASTREA EXTRACTOR");
  lines.push("");
  lines.push(`Título: ${metadata.book.title ?? "Pendiente"}`);
  lines.push(`Autor: ${metadata.book.author ?? "Pendiente"}`);
  lines.push(`Edición: ${metadata.book.edition ?? "Pendiente"}`);
  lines.push(`ID Astrea: ${metadata.book.astreaBookId}`);
  lines.push(`Estado: ${metadata.book.status}`);
  lines.push(`Páginas totales: ${metadata.book.totalPages ?? "Pendiente"}`);
  lines.push(`Páginas procesadas: ${metadata.processedPages}`);
  lines.push(`Páginas fallidas: ${metadata.failedPages}`);
  lines.push(`Fecha de extracción: ${formatDate(metadata.extractedAt)}`);
  lines.push(`Fecha de exportación: ${formatDate(metadata.exportedAt)}`);
  lines.push("");

  if (chapters.length > 0) {
    lines.push("CAPÍTULOS");
    lines.push("");

    for (const chapter of chapters) {
      lines.push(
        `${chapter.order}. ${chapter.title} (${chapter.startPage ?? "?"}-${chapter.endPage ?? "?"})`,
      );
    }

    lines.push("");
  }

  lines.push("CONTENIDO");

  for (const page of pages) {
    lines.push("");
    lines.push(`--- Página ${page.pageNumber} ---`);
    lines.push("");

    if (page.status === "ready" && page.text) {
      lines.push(page.text.trim());
      continue;
    }

    if (page.status === "failed") {
      lines.push(`[Página fallida: ${page.errorMessage ?? "sin detalle"}]`);
      continue;
    }

    lines.push(`[Página ${page.status}]`);
  }

  lines.push("");
  return lines.join("\n");
}

function formatDate(date: Date | null) {
  return date ? date.toISOString() : "Pendiente";
}