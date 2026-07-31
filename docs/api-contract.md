# Contrato API

## `GET /health`

Devuelve estado de API y navegador.

## `POST /browser/open`

Abre Chromium administrado apuntando a Astrea Virtual.

## `GET /browser/status`

Devuelve estado del Chromium administrado.

## `POST /extract`

Crea un job asincrono en memoria.

### Body

```ts
{
  bookcode?: string
  title?: string
  pages: number[]
  ocrProvider?: "openai"
  openAiModel?: "gpt-5.6-terra" | "gpt-5.6-sol" | "gpt-5.6-luna"
}
```

### Validaciones

- `bookcode` o `title` requerido.
- `pages` requerido.
- `pages` debe contener enteros positivos.
- maximo 100 paginas unicas.
- la API ordena y deduplica paginas.

## `GET /extract/:jobId`

Devuelve estado y resultado del job.

### Estados

- `queued`: job creado, todavia no empezo.
- `processing`: extraccion en curso.
- `completed`: todas las paginas se extrajeron correctamente.
- `completed_with_errors`: al menos una pagina se extrajo y al menos una fallo.
- `failed`: no se pudo extraer ninguna pagina o fallo el job completo.

## Politica de errores

- Cada pagina se reintenta hasta 3 veces.
- Si una pagina falla, se registra en `failedPages` y el proceso continua con la pagina siguiente.
- `combinedText` se arma con las paginas exitosas.
- Si hay errores parciales, `combinedText` empieza con `Paginas no extraidas: ...` para que Claude no asuma que el texto esta completo.
- `error` queda reservado para fallos globales del job.
