# apps/worker

Worker de ingesta y procesamiento de libros.

## Responsabilidad

Este módulo ejecutará el procesamiento serial de libros.

Debe encargarse de:

- tomar jobs pendientes;
- procesar un libro a la vez;
- reutilizar la lógica existente de extracción;
- obtener metadata desde Astrea;
- capturar páginas;
- ejecutar OCR con OpenAI;
- detectar capítulos automáticamente;
- persistir páginas, texto, capítulos y errores;
- marcar jobs como completados, parciales o fallidos.

## Límites

No debe contener UI ni lógica de sesión de usuario web.

La webapp solicita trabajos; el worker los ejecuta.

