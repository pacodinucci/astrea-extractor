# Pipeline de ingesta

La ingesta debe ser tolerante a fallos. Un libro de 500 páginas no puede fallar entero porque una página tuvo un timeout.

## Flujo feliz

1. Usuario solicita libro completo o rango.
2. API crea `IngestionJob`.
3. API encola el job.
4. Worker toma el job.
5. Worker procesa página por página.
6. Cada página guarda captura, texto y estado.
7. Job termina como `available`, `partial` o `failed`.
8. Usuario descarga el resultado.

## Estados del job

| Estado | Significado |
| --- | --- |
| `queued` | Esperando worker |
| `running` | Procesando |
| `partial` | Terminó con algunas páginas fallidas |
| `completed` | Todas las páginas procesadas |
| `failed` | Fallo general no recuperable |
| `cancelled` | Cancelado por usuario/admin |

## Estrategia por página

Cada página debe procesarse como unidad independiente:

1. abrir/navegar página;
2. capturar imagen o contenido;
3. enviar a OCR si hace falta;
4. guardar texto;
5. marcar resultado;
6. continuar con la siguiente.

## Reintentos

Recomendación inicial:

- 3 intentos por página;
- backoff incremental;
- guardar el último error;
- permitir reintento manual de páginas fallidas.

## Resultado parcial

Un resultado parcial NO es un fracaso. Es una respuesta honesta del sistema.

Ejemplo:

- Libro: 320 páginas.
- Procesadas: 314.
- Fallidas: 6.
- Estado: `partial`.
- Acción disponible: descargar parcial o reintentar fallidas.

## Concurrencia

Arrancar conservador:

- 1 libro por worker;
- páginas secuenciales dentro del libro;
- límite global de jobs concurrentes.

Después, si la plataforma lo permite, se puede paralelizar. Pero primero confiabilidad. VELOCIDAD sin control es deuda técnica con maquillaje.

## Observabilidad mínima

Guardar:

- duración total del job;
- duración por página;
- errores por tipo;
- páginas reintentadas;
- costo estimado de OCR;
- usuario que solicitó el job.

