# API y experiencia de usuario

La UX debe mostrar procesos largos con claridad. El usuario no necesita ver magia: necesita saber qué pidió, en qué estado está y qué puede descargar.

## Pantallas iniciales

| Pantalla | Función |
| --- | --- |
| Login | Acceso autorizado |
| Biblioteca | Lista de libros disponibles y solicitados |
| Detalle de libro | Metadata, páginas, estado y descargas |
| Nueva ingesta | Pedir libro completo o rango |
| Jobs | Ver progreso, errores y reintentos |
| Descargas | Exportar TXT, Markdown, PDF o ZIP |

## Endpoints sugeridos

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/books` | Registrar libro |
| `GET` | `/books` | Listar biblioteca |
| `GET` | `/books/:id` | Ver detalle |
| `POST` | `/books/:id/ingestions` | Crear job de ingesta |
| `GET` | `/ingestions/:id` | Ver estado del job |
| `POST` | `/ingestions/:id/retry-failed` | Reintentar páginas fallidas |
| `POST` | `/books/:id/exports` | Crear export |
| `GET` | `/exports/:id/download` | Descargar archivo generado |

## Contrato de creación de ingesta

Ejemplo conceptual:

```json
{
  "mode": "full_book",
  "fromPage": null,
  "toPage": null
}
```

Para rango:

```json
{
  "mode": "page_range",
  "fromPage": 10,
  "toPage": 40
}
```

## UX de progreso

Mostrar:

- estado general;
- páginas totales;
- páginas procesadas;
- páginas fallidas;
- tiempo aproximado si está disponible;
- último error relevante;
- acciones disponibles.

## Acciones por estado

| Estado | Acción |
| --- | --- |
| `queued` | cancelar |
| `running` | ver progreso |
| `partial` | descargar parcial o reintentar fallidas |
| `completed` | descargar/exportar |
| `failed` | ver error y relanzar |

## Regla de producto

Nunca ocultar errores. Si una página falló, el usuario debe verlo. La confianza en este tipo de plataforma viene de mostrar el estado real, no de fingir éxito.

