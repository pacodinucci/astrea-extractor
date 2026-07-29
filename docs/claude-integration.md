# Integración Claude ↔ Astrea Extractor

Esta app expone una API local para que Claude solicite extracción de texto desde páginas ya conocidas del reader de Astrea Virtual.

## Base URL

```txt
http://127.0.0.1:4317
```

La API no tiene autenticación en el MVP y solo debe escuchar en `127.0.0.1`.

## Reglas para Claude

- Usar `bookcode` siempre que esté disponible.
- Si no hay `bookcode`, puede enviar `title`, pero el MVP puede requerir desambiguación manual.
- Enviar páginas del **reader de Astrea**, no páginas impresas.
- Enviar páginas como lista explícita de enteros.
- No enviar rangos tipo `"45-60"`.
- Máximo 100 páginas por request.
- No enviar credenciales de Astrea.
- Si el job queda `failed`, no usar resultados parciales.

## Flujo recomendado

### 1. Verificar estado

```http
GET /health
```

### 2. Crear extracción

```http
POST /extract
Content-Type: application/json
```

```json
{
  "bookcode": "00119000",
  "pages": [45, 46, 47]
}
```

Respuesta:

```json
{
  "jobId": "ext_abc123",
  "status": "queued"
}
```

### 3. Consultar estado hasta terminar

```http
GET /extract/ext_abc123
```

Mientras procesa:

```json
{
  "jobId": "ext_abc123",
  "status": "processing",
  "progress": {
    "total": 3,
    "completed": 1,
    "failed": 0
  }
}
```

Completado:

```json
{
  "jobId": "ext_abc123",
  "status": "completed",
  "bookcode": "00119000",
  "combinedText": "--- Página 45 ---\n...",
  "pages": [
    {
      "page": 45,
      "text": "...",
      "method": "pdf_text_layer",
      "attempts": 1,
      "status": "completed"
    }
  ]
}
```

Fallido:

```json
{
  "jobId": "ext_abc123",
  "status": "failed",
  "error": {
    "page": 46,
    "code": "PAGE_EXTRACTION_FAILED",
    "message": "No se pudo extraer texto después de 3 intentos"
  }
}
```

## Operación del usuario

1. Abrir Astrea Extractor.
2. Click en **Abrir navegador Astrea**.
3. Iniciar sesión en Astrea en el Chromium administrado.
4. Claude usa ese mismo navegador para determinar libro/páginas.
5. Claude llama a esta API local.

