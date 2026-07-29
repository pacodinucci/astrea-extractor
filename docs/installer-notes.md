# Instaladores MVP

El MVP usa `electron-builder`.

## Scripts

```bash
npm run package
npm run dist
```

No ejecutar build automáticamente durante desarrollo si no se pidió explícitamente.

## Plataformas

- Windows: NSIS.
- macOS: DMG.

## Firma

El MVP no usa firma de código ni notarización.

Consecuencias:

- Windows puede mostrar SmartScreen.
- macOS puede mostrar Gatekeeper.

## Chromium administrado

El runtime inicial usa Playwright Chromium. Para distribución cerrada hay dos opciones:

1. Empaquetar el browser cache de Playwright dentro de recursos de la app.
2. Descargar/verificar Chromium en primer arranque.

Para MVP interno, se puede validar primero con Chromium disponible en el entorno de desarrollo y luego cerrar la estrategia final de bundling.

