# Contrato API

## `GET /health`

Devuelve estado de API y navegador.

## `POST /browser/open`

Abre Chromium administrado apuntando a Astrea Virtual.

## `GET /browser/status`

Devuelve estado del Chromium administrado.

## `POST /extract`

Crea un job asíncrono en memoria.

### Body

```ts
{
  bookcode?: string
  title?: string
  pages: number[]
}
```

### Validaciones

- `bookcode` o `title` requerido.
- `pages` requerido.
- `pages` debe contener enteros positivos.
- máximo 100 páginas únicas.
- la API ordena y deduplica páginas.

## `GET /extract/:jobId`

Devuelve estado y resultado del job.

## Política de errores

- Cada página se reintenta hasta 3 veces.
- Si una página falla, falla todo el job.
- `combinedText` solo existe cuando el job está `completed`.

