# Estructura monorepo recomendada

La plataforma debe evolucionar dentro del repo existente, pero separando responsabilidades. La decisión recomendada es convertir el proyecto en un **monorepo simple**.

## Decisión

Usar esta estructura base:

```txt
apps/
  web/
  worker/
packages/
  db/
  core/
docs/
```

## Por qué conviene

El extractor actual funciona y debe aprovecharse, pero la nueva plataforma necesita piezas con ciclos de vida distintos:

| Pieza | Responsabilidad |
| --- | --- |
| `apps/web` | Webapp Next.js, Better Auth, UI, rutas y acciones de usuario |
| `apps/worker` | Procesamiento serial de libros, OCR, scraping/captura y jobs |
| `packages/db` | Prisma schema, Prisma Client y acceso compartido a Neon PostgreSQL |
| `packages/core` | Tipos, contratos, estados, helpers y reglas de dominio compartidas |
| `docs` | Decisiones, arquitectura y guías del proyecto |

## Qué reutilizar del proyecto actual

La app Electron actual no debe trasladarse tal cual al servidor. Lo valioso a preservar es:

- lógica de extracción;
- manejo de navegación/captura;
- OCR con OpenAI;
- tolerancia a fallos por página;
- contratos ya probados;
- aprendizajes sobre Chrome/Astrea.

Esa lógica debe migrar gradualmente hacia `apps/worker` y/o `packages/core`.

## Qué NO hacer

No conviene mezclar Next.js, worker, Prisma y lógica de extracción dentro de un único `src/` genérico.

Eso parece rápido al principio, pero genera acoplamiento:

- UI con lógica de scraping;
- API con detalles de OCR;
- worker dependiendo de componentes visuales;
- modelos duplicados;
- tests difíciles de ubicar.

## Primer slice recomendado

El primer paso técnico debería ser estructural, sin reescribir todo:

1. crear `apps/web`;
2. crear `packages/db`;
3. crear `packages/core`;
4. dejar el extractor actual funcionando mientras se migra;
5. mover solo lo estrictamente necesario para crear el primer flujo web.

## Regla de migración

Migrar por capacidades, no por carpetas enteras.

Primero:

- tipos compartidos;
- estados de libro/job/página;
- Prisma schema;
- creación/listado de libros;
- creación de jobs.

Después:

- worker real;
- OCR;
- capítulos;
- export TXT;
- búsqueda.

## Tradeoff

| Costo | Beneficio |
| --- | --- |
| Más estructura inicial | Menos deuda arquitectónica |
| Más decisiones de tooling | Separación clara web/worker/db |
| Migración gradual | Se conserva lo que ya funciona |

## Regla final

El repo existente sigue siendo la base, pero la arquitectura nueva debe tener límites claros. No estamos “metiendo una webapp adentro de Electron”; estamos separando producto web, motor de ingesta y dominio compartido.