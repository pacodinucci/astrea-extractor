# apps/web

Webapp principal de Astrea Extractor.

## Responsabilidad

Esta app contendrá:

- Next.js;
- Better Auth;
- UI de registro/login;
- biblioteca común de libros;
- detalle de libro;
- navegación por páginas y capítulos;
- búsqueda dentro de un libro;
- descarga TXT.

## Límites

No debe contener lógica directa de scraping, OCR o procesamiento pesado.

La webapp crea solicitudes, muestra estados y permite consumir resultados. El procesamiento real pertenece a `apps/worker`.

