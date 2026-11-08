# De La Geezy

Aplicación web personal, local-first y mobile-first para registrar y entender las finanzas del hogar.

> Tu plata, sin chamuyo.

El MVP usa React, TypeScript, Vite, Tailwind CSS v4, Dexie/IndexedDB y Vitest. No requiere backend ni autenticación: los datos financieros permanecen en el navegador del dispositivo donde se usa.

## Puesta en marcha

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev
```

Vite mostrará la dirección local de la aplicación. Para producir una versión optimizada:

```bash
npm run build
npm run preview
```

Para ejecutar las pruebas automáticas:

```bash
npm test
npm run test:e2e
```

Playwright ejecuta una matriz Mobile First en Chromium (320×568, 375×812, 390×844, 844×390, 768×1024, 1280×800 y 1440×900) y controles móviles representativos en WebKit (375×812 y 390×844). La primera vez, instalar los motores requeridos:

```bash
npx playwright install chromium webkit
```

Los comandos especializados son:

```bash
npm run test:responsive     # geometría, overflow, navegación, overlays y targets táctiles
npm run test:visual         # comparación con referencias aprobadas
npm run test:visual:update  # regenerar referencias después de una revisión visual intencional
npx playwright test e2e/accessibility.spec.ts # auditoría automatizada WCAG A/AA
```

Las referencias visuales no deben actualizarse para ocultar una diferencia. Primero se revisa el reporte, se confirma que el cambio es correcto y recién entonces se ejecuta `test:visual:update`. La automatización de GitHub Actions ejecuta tipos, unitarias, build y la matriz E2E completa; ante una falla conserva capturas, trazas y videos durante 14 días.

## Calidad y versiones locales

El flujo replica el utilizado en `sanseperfumes`:

```bash
npm run doctor
npm run doctor:react
npm run doctor:dead-code
npm run check

npm run version:patch
npm run version:minor
npm run version:major
```

Los comandos de versión actualizan `package.json` y `package-lock.json` sin crear un tag de Git.

## Estado

El MVP integra movimientos completos, transferencias entre monedas, tarjetas y cuotas con anulación auditable, recurrentes, análisis y deudas.

## Principios

- Importes en unidades monetarias mínimas enteras; nada de `float` para cálculos financieros.
- Transferencias y pagos de tarjeta no duplican ingresos ni gastos.
- Almacenamiento versionado y reemplazable mediante repositorios.
- El análisis de gastos usa la fecha de consumo y excluye pagos que duplicarían compras ya registradas.
- Los datos de demostración, si existen durante desarrollo, nunca se mezclan con datos reales.
- Interfaz en español de Argentina, con ARS como moneda principal y USD como secundaria.

## Estructura prevista

```text
src/
  domain/       motor financiero puro e independiente de React
  models/       contratos y validaciones de entidades
  data/         IndexedDB, repositorios y servicios externos
  components/   componentes visuales reutilizables
  features/     casos de uso y pantallas por módulo
docs/           arquitectura, modelo de datos y reglas
```

La estructura puede evolucionar durante la implementación manteniendo la separación entre dominio, persistencia y presentación.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Reglas financieras](docs/FINANCIAL_RULES.md)

## Privacidad y datos

Los datos permanecen en el navegador y no se sincronizan con otros dispositivos. Limpiar los datos del sitio o perder el dispositivo puede eliminar la información local.

## Alcance deliberado

El MVP no incluye sincronización bancaria, múltiples usuarios, autenticación remota, sincronización entre dispositivos, OCR ni envío automático de emails.
