# packages/db

Capa compartida de base de datos.

## Responsabilidad

Este paquete contendrá:

- Prisma schema;
- Prisma Client;
- migraciones;
- helpers mínimos de acceso a datos;
- conexión a Neon PostgreSQL.

## Modelo inicial esperado

El modelo deberá representar:

- usuarios y sesiones de Better Auth;
- libros globales deduplicados por ID;
- páginas;
- capítulos;
- jobs de ingesta;
- exports TXT;
- historial/auditoría cuando haga falta.

## Límites

No debe contener reglas de UI ni lógica de scraping/OCR.

