# Estado actual del pivot webapp

El repo ya tiene la base de plataforma web/worker montada dentro del proyecto existente. Todavía no está listo para correr contra Neon porque faltan URLs reales y migración de DB, pero la arquitectura base ya está encaminada.

## Listo

| Área | Estado |
| --- | --- |
| Monorepo | `apps/*` y `packages/*` configurados en npm workspaces |
| Webapp | `apps/web` con Next.js App Router |
| Auth | Better Auth preparado con Prisma adapter |
| DB | Prisma 7 + Neon adapter preparado |
| Core | Tipos/contratos compartidos en `packages/core` |
| Worker | `apps/worker` con cola serial y extractor server-safe |
| Libros | Biblioteca común, deduplicada por `astreaBookId` |
| Jobs | Job modes `full_book` y `retry_failed_pages` |
| Páginas | Persistencia de páginas `ready`/`failed` |
| Parciales | Estado `partial`, descarga parcial y reintento de fallidas |
| Export | TXT con metadata, capítulos y separadores por página |
| Docs | Documentación del pivot en `docs/platform-pivot/` |

## Validado sin build

Se validó con typecheck, no build:

```bash
npm run typecheck --workspace @astrea/core
npm run typecheck --workspace @astrea/db
npm run typecheck --workspace @astrea/web
npm run typecheck --workspace @astrea/worker
```

## Falta para correr real

| Falta | Por qué importa |
| --- | --- |
| Crear DB en Neon | Sin DB real no hay persistencia |
| Crear `.env` local | Faltan `DATABASE_URL`, `DIRECT_URL`, secrets y API keys reales |
| Aplicar schema | Hay que correr `npx prisma db push` o migración |
| Probar Better Auth real | Registro/login dependen de DB funcionando |
| Probar worker con Astrea real | Necesita sesión, Chrome y OpenAI key |
| Ajustar metadata/capítulos | La heurística inicial debe validarse con DOM real de Astrea |

## Riesgos actuales

| Riesgo | Mitigación |
| --- | --- |
| Metadata incompleta | El worker falla claro si no hay `totalPages`; se puede usar `ASTREA_WORKER_PAGES` para pruebas |
| Capítulos heurísticos | Validar contra libros reales y ajustar selectores/patrones |
| Sesión Astrea en servidor | Usar `ASTREA_PROFILE_PATH` persistente y Chrome controlado por CDP |
| Prisma 7 | Ya se adaptó a `prisma.config.ts` y `@prisma/adapter-neon` |
| Cambios previos no relacionados | Revisar `git status` antes de commit para no mezclar work units |

## Próximo bloque recomendado

No seguir agregando features a ciegas. El próximo bloque debe ser **integración real con entorno**:

1. crear Neon;
2. cargar `.env`;
3. aplicar schema;
4. registrar usuario;
5. pedir libro con `ASTREA_WORKER_PAGES` limitado;
6. correr worker contra pocas páginas;
7. validar que se guarden páginas y se pueda descargar TXT.

## Regla de avance

Hasta tener Neon y `.env` reales, cualquier feature nueva aumenta deuda. La plataforma ya tiene esqueleto suficiente; ahora necesita una prueba end-to-end chica.