# Plan de migración del extractor al worker

El extractor actual funciona y debe reutilizarse, pero no puede moverse entero al servidor sin separar dependencias de Electron.

## Diagnóstico

Archivos actuales relevantes:

| Archivo | Uso actual | Reutilización |
| --- | --- | --- |
| `src/main/extraction/astrea-extractor.ts` | Extrae páginas desde Astrea usando Playwright y OCR OpenAI | Alta |
| `src/main/extraction/job-manager.ts` | Maneja jobs en memoria para la app Electron | Baja para webapp |
| `src/main/extraction/types.ts` | Contrato del extractor actual | Media |
| `src/main/browser/browser-controller.ts` | Abre/controla Chrome con CDP | Media, pero requiere adaptación |

## Decisión

Migrar por capacidades, no por carpetas enteras.

El objetivo no es copiar `src/main` a `apps/worker`. El objetivo es extraer las piezas que sirven y adaptarlas al entorno servidor.

## Problema principal

`BrowserController` depende de Electron:

```ts
import { app } from "electron";
```

Y usa:

```ts
app.getPath("userData")
```

Eso no sirve directamente en `apps/worker`, porque el worker corre como proceso Node en servidor, no como proceso Electron.

## Adaptación necesaria

Crear un controlador server-safe para el worker:

```txt
apps/worker/src/browser/server-browser-controller.ts
```

Ese controlador debe:

- usar `process.env.ASTREA_CHROMIUM_PATH` si existe;
- usar rutas candidatas de Chrome/Chromium según sistema operativo;
- usar `process.env.ASTREA_PROFILE_PATH` para el perfil persistente;
- abrir Chrome con CDP;
- mantener un perfil persistente para la sesión Astrea;
- no importar nada de Electron.

## Qué reutilizar de AstreaExtractor

`AstreaExtractor` ya contiene lógica valiosa:

- abrir reader por bookcode;
- esperar controles del reader;
- cambiar de página;
- capturar imagen;
- enviar OCR a OpenAI;
- retry por página;
- continuar con páginas restantes si una falla.

Pero necesita desacoplarse de:

- tipos viejos de `src/shared/extraction` cuando choquen con `packages/core`;
- `OpenAiSettingsStore` de Electron;
- `BrowserController` Electron-bound.

## Nuevo adapter de settings

El worker debería usar settings por env:

```txt
OPENAI_API_KEY
OPENAI_OCR_MODEL
```

En vez de leer configuración desde storage Electron.

## JobManager actual

`JobManager` actual es in-memory. Para la webapp no conviene reutilizarlo como fuente de verdad.

La fuente de verdad ahora es Neon/PostgreSQL:

- `IngestionJob`
- `Book`
- `BookPage`
- `BookChapter`

El worker debe tomar jobs desde DB, no desde memoria.

## Primer slice técnico recomendado

1. Crear `apps/worker/src/settings/openai-settings.ts` basado en env.
2. Crear `apps/worker/src/browser/server-browser-controller.ts` sin Electron.
3. Crear `apps/worker/src/extraction/worker-page-extractor.ts` reutilizando la lógica de `AstreaExtractor`.
4. Conectar `processIngestionJob` para:
   - leer `job.book.astreaBookId`;
   - detectar metadata;
   - procesar páginas;
   - guardar `BookPage`;
   - actualizar progreso;
   - marcar `available`, `partial` o `failed`.

## Regla de seguridad arquitectónica

No importar módulos de Electron desde `apps/worker`.

Si un archivo importa `electron`, pertenece al runtime desktop, no al runtime servidor.

## Orden recomendado

Primero adaptar infraestructura:

1. browser server-safe;
2. settings server-safe;
3. extractor server-safe;
4. persistencia página por página;
5. detección de capítulos;
6. metadata automática;
7. procesamiento completo real.

No empezar por capítulos ni metadata antes de tener una página procesada y persistida desde el worker. Eso sería construir el techo antes de las columnas.