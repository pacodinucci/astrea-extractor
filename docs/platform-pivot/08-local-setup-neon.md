# Setup local con Neon y Prisma

Esta guía deja preparado el camino para conectar la webapp a Neon PostgreSQL cuando estén disponibles las URLs reales.

## Estado actual

Ya existe:

- monorepo npm con `apps/*` y `packages/*`;
- `apps/web` con Next.js y Better Auth;
- `apps/worker` con worker serial;
- `packages/db` con Prisma schema;
- `packages/core` con tipos/contratos;
- `prisma.config.ts` para Prisma 7;
- `.env.example` con variables esperadas.

Todavía falta:

- crear proyecto/base en Neon;
- copiar URLs reales;
- crear `.env` local;
- aplicar schema a la DB.

## Variables necesarias

Crear `.env` en la raíz del repo usando `.env.example` como base.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.neon.tech/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
BETTER_AUTH_SECRET="replace-with-a-secure-random-secret"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
```

## DATABASE_URL vs DIRECT_URL

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Runtime de la app/worker. Idealmente URL pooled de Neon. |
| `DIRECT_URL` | Prisma CLI/migraciones. Debe ser conexión directa. |

En Prisma 7, la URL del datasource no vive en `schema.prisma`; vive en `prisma.config.ts`.

## Comandos cuando estén las URLs

Desde la raíz del repo:

```bash
npm install
npx prisma generate
npx prisma db push
```

`db push` alcanza para el MVP inicial. Más adelante, cuando el modelo se estabilice, conviene pasar a migraciones versionadas con `prisma migrate dev`.

## Validación sin build

No ejecutar build por convención del proyecto.

Validaciones recomendadas:

```bash
npm run typecheck --workspace @astrea/core
npm run typecheck --workspace @astrea/db
npm run typecheck --workspace @astrea/web
npm run typecheck --workspace @astrea/worker
```

## Primer arranque local esperado

Cuando la DB esté aplicada:

```bash
npm run dev --workspace @astrea/web
```

Luego abrir:

```txt
http://localhost:3000
```

Flujo esperado:

1. crear cuenta;
2. entrar a `/library`;
3. solicitar libro por ID de Astrea;
4. ver job en `/jobs`;
5. cuando el worker real esté conectado, ver páginas/capítulos/texto;
6. descargar TXT desde el detalle del libro.

## Worker

El worker todavía es placeholder. Cuando esté listo para ejecución real:

```bash
npm run dev --workspace @astrea/worker
```

Actualmente:

- toma un job `queued` si no hay otro `running`;
- marca el libro como `processing`;
- ejecuta placeholder;
- marca éxito/fallo.

Falta conectar la lógica real de extracción existente.

## Cuidado importante

No usar GitHub como storage de textos/libros.

La fuente de verdad es Neon PostgreSQL:

- metadata;
- páginas;
- capítulos;
- texto por página;
- jobs;
- eventos de descarga.

El TXT es un export generado desde esos datos.