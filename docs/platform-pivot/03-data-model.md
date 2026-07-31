# Modelo de datos

El modelo actual usa Neon PostgreSQL con Prisma. La fuente de verdad será la base de datos, no archivos TXT en GitHub.

## Decisión principal

El libro es global y se deduplica por `astreaBookId`.

Si un libro ya fue procesado, otro usuario no dispara una nueva extracción: descarga o navega el contenido existente.

## Entidades actuales

| Entidad | Para qué existe |
| --- | --- |
| `User` | Usuario registrado mediante Better Auth |
| `Session` | Sesión de Better Auth |
| `Account` | Cuenta/proveedor de Better Auth |
| `Verification` | Tokens/verificaciones de Better Auth |
| `Book` | Libro global deduplicado por ID de Astrea |
| `BookPage` | Página individual con texto y estado |
| `BookChapter` | Capítulo detectado automáticamente |
| `IngestionJob` | Trabajo serial para procesar un libro |
| `BookExport` | Export descargable, inicialmente TXT |
| `BookDownloadEvent` | Evento de descarga para trazabilidad |

## Book

Campos principales:

- `id`
- `astreaBookId` único
- `title`
- `author`
- `edition`
- `totalPages`
- `status`
- `extractedAt`
- `createdAt`
- `updatedAt`

Estados:

- `requested`
- `queued`
- `processing`
- `available`
- `partial`
- `failed`

## BookPage

Campos principales:

- `id`
- `bookId`
- `pageNumber`
- `status`
- `text`
- `errorMessage`
- `processedAt`
- `createdAt`
- `updatedAt`

Reglas:

- una página es única por `bookId + pageNumber`;
- el texto se guarda por página para navegación, búsqueda y export;
- una página fallida no debe hacer fallar necesariamente el libro completo.

Estados:

- `pending`
- `captured`
- `ocr_processing`
- `ready`
- `failed`
- `skipped`

## BookChapter

Campos principales:

- `id`
- `bookId`
- `title`
- `order`
- `startPage`
- `endPage`
- `createdAt`
- `updatedAt`

Reglas:

- los capítulos los detecta el sistema automáticamente;
- el usuario debe poder navegar el libro por capítulos;
- cada capítulo apunta a un rango de páginas cuando esa información esté disponible.

## IngestionJob

Campos principales:

- `id`
- `bookId`
- `requestedByUserId`
- `status`
- `progressTotal`
- `progressDone`
- `progressFailed`
- `startedAt`
- `finishedAt`
- `errorSummary`
- `createdAt`
- `updatedAt`

Estados:

- `queued`
- `running`
- `completed`
- `partial`
- `failed`
- `cancelled`

Reglas:

- cada job procesa un solo libro;
- la cola global procesa un solo libro a la vez;
- si el libro ya está `available`, no se crea un nuevo job;
- si el libro está `queued` o `processing`, el usuario ve el estado existente.

## BookExport

Campos principales:

- `id`
- `bookId`
- `requestedByUserId`
- `format`
- `status`
- `fileName`
- `content`
- `errorMessage`
- `createdAt`
- `updatedAt`

Formato inicial:

- `txt`

Reglas:

- el TXT debe incluir metadata;
- debe incluir separadores por página;
- debe contener el texto corrido del libro;
- inicialmente puede guardarse en DB como `content`;
- si el tamaño crece demasiado, se podrá mover a object storage más adelante.

## BookDownloadEvent

Campos principales:

- `id`
- `bookId`
- `userId`
- `format`
- `createdAt`

Uso:

- auditar descargas;
- entender uso por usuario;
- medir qué libros se consumen más.

## Búsqueda

El MVP debe permitir buscar dentro de un libro específico.

La búsqueda debe operar sobre `BookPage.text` filtrando por `bookId` y devolver:

- página;
- capítulo cuando aplique;
- snippet;
- link o referencia para navegar al resultado.

## Regla importante

El dato principal no es el TXT final. El dato principal es la estructura persistida:

- libro;
- páginas;
- capítulos;
- texto por página;
- estado de extracción;
- eventos de descarga.

El TXT es un export generado desde esa estructura.