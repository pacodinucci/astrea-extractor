# Roadmap de implementación

El roadmap debe reducir riesgo. Primero persistencia y jobs; después automatización avanzada.

## Fase 1 — Base de plataforma

Objetivo: tener una webapp mínima que registre libros y cree jobs.

Checklist:

- [ ] Definir stack web/backend.
- [ ] Crear autenticación básica.
- [ ] Crear entidades `Book` e `IngestionJob`.
- [ ] Crear pantalla de biblioteca.
- [ ] Crear pantalla de detalle de libro.
- [ ] Crear endpoint para solicitar ingesta.

## Fase 2 — Worker de ingesta

Objetivo: procesar páginas de forma asincrónica y persistente.

Checklist:

- [ ] Crear cola de trabajos.
- [ ] Crear worker.
- [ ] Procesar rango de páginas.
- [ ] Guardar estado por página.
- [ ] Implementar retries.
- [ ] Marcar jobs como `completed`, `partial` o `failed`.

## Fase 3 — OCR y almacenamiento

Objetivo: guardar texto y assets recuperables.

Checklist:

- [ ] Integrar OCR OpenAI.
- [ ] Guardar texto por página.
- [ ] Guardar capturas o archivos fuente en storage.
- [ ] Registrar errores por página.
- [ ] Medir costo/duración por job.

## Fase 4 — Descargas

Objetivo: permitir que usuarios bajen resultados.

Checklist:

- [ ] Generar TXT.
- [ ] Generar Markdown.
- [ ] Generar ZIP.
- [ ] Crear registro `Export`.
- [ ] Descargar exports desde la UI.

## Fase 5 — Robustez operativa

Objetivo: preparar la plataforma para uso real.

Checklist:

- [ ] Dashboard de jobs.
- [ ] Reintento de páginas fallidas.
- [ ] Cancelación de jobs.
- [ ] Auditoría.
- [ ] Límites de concurrencia.
- [ ] Logs y métricas.

## Fase 6 — Funciones avanzadas

Objetivo: convertir la biblioteca en producto potente.

Posibles mejoras:

- búsqueda full-text;
- búsqueda semántica;
- chat sobre libros;
- resúmenes automáticos;
- citas por página;
- comparación entre ediciones;
- API para agentes externos.

## Orden recomendado

No arrancar por la UI linda. Arrancar por el flujo que prueba la arquitectura:

1. crear libro;
2. crear job;
3. worker procesa páginas;
4. guardar texto;
5. descargar resultado.

Si ese circuito funciona, el resto se construye encima. Si ese circuito está mal, todo lo demás es decoración.

