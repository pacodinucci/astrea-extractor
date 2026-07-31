# packages/core

Dominio compartido de la plataforma.

## Responsabilidad

Este paquete contendrá tipos, contratos y reglas compartidas entre webapp y worker.

Ejemplos:

- estados de libro;
- estados de job;
- estados de página;
- contratos de creación de ingesta;
- helpers de export TXT;
- reglas de deduplicación por ID de libro.

## Límites

No debe depender de Next.js, Electron, Playwright ni Prisma directamente salvo que haya una decisión explícita posterior.

Debe mantenerse como núcleo liviano y reutilizable.

