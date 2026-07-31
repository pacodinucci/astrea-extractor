# Visión del producto

La plataforma debe permitir que usuarios autorizados soliciten libros, esperen su procesamiento y descarguen los resultados sin depender de una extracción manual página por página.

## Cambio de enfoque

| Antes | Ahora |
| --- | --- |
| App Electron local | Webapp en servidor |
| Extracción puntual | Ingesta de libros completos o rangos |
| Resultado temporal | Biblioteca persistente |
| Un usuario en una máquina | Usuarios con acceso controlado |
| Claude llama una API local | UI/API consumen datos procesados |

## Objetivo

Construir una biblioteca documental privada donde cada libro pueda pasar por estos estados:

1. solicitado;
2. en cola;
3. descargándose/capturándose;
4. procesándose con OCR;
5. validado;
6. disponible para descarga;
7. fallido o parcial con diagnóstico.

## Alcance inicial

El MVP debe soportar:

- login de usuarios;
- alta manual de un libro;
- solicitud de ingesta de libro completo o rango de páginas;
- estado visible del proceso;
- almacenamiento de texto por página;
- descarga en formatos simples;
- reintento de páginas fallidas.

## Fuera del MVP

No metería todavía:

- búsqueda semántica;
- chat sobre la biblioteca;
- multi-tenant complejo;
- edición colaborativa;
- versionado avanzado de OCR;
- automatización masiva sin límites.

Eso viene después. Primero la base.

## Criterio de éxito

El sistema es exitoso cuando un usuario puede pedir un libro, cerrar la webapp, volver más tarde y descargar el resultado completo o parcial con claridad sobre qué salió bien y qué falló.

