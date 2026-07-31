# Pivot hacia webapp de biblioteca documental

Esta documentación define cómo pasar de una app Electron de extracción puntual a una plataforma web con ingesta, persistencia y descarga de libros completos.

## Decisión principal

Vamos a tratar el sistema como una **plataforma de procesamiento documental**, no como “la app actual subida a un servidor”.

Eso implica:

- ingesta asincrónica por trabajos;
- almacenamiento persistente de libros, páginas y texto extraído;
- descarga/exportación para usuarios;
- control de acceso;
- trazabilidad de cada extracción;
- una API estable para UI, usuarios externos y futuros agentes.

## Lectura recomendada

1. [Visión del producto](./01-product-vision.md)
2. [Arquitectura recomendada](./02-architecture.md)
3. [Modelo de datos](./03-data-model.md)
4. [Pipeline de ingesta](./04-ingestion-pipeline.md)
5. [API y experiencia de usuario](./05-api-and-ux.md)
6. [Roadmap de implementación](./06-roadmap.md)
7. [Estructura monorepo](./07-monorepo-structure.md)
8. [Setup local con Neon](./08-local-setup-neon.md)
9. [Migración del extractor al worker](./09-worker-migration-plan.md)
10. [Estado actual](./10-current-status.md)

## Principio rector

Primero construimos una plataforma que procese libros de forma confiable. Después optimizamos escala, experiencia y automatización.

No conviene empezar por “descargar todo lo posible”. Conviene empezar por:

1. registrar un libro;
2. lanzar un job de ingesta;
3. guardar páginas/texto;
4. permitir descarga;
5. auditar el resultado.