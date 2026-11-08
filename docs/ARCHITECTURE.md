# Arquitectura

## Objetivos

De La Geezy prioriza exactitud financiera, carga rápida, lectura clara y funcionamiento local. La arquitectura evita acoplar las reglas del dinero a React o a IndexedDB, de modo que la interfaz y la persistencia puedan cambiar sin reescribir el dominio.

## Capas

```text
UI React
  ↓ comandos / consultas
Casos de uso y estado de aplicación
  ↓ contratos de repositorio
Dominio financiero puro
  ↕
Adaptadores Dexie / API de cotización / archivos
```

### Dominio

Contiene tipos, invariantes y funciones puras: unidades monetarias mínimas, saldos, indicadores, transferencias, cuotas, pasivos, recurrencias y conversiones. No importa React, Dexie ni APIs del navegador. Sus resultados deben ser deterministas y verificables con pruebas de valores conocidos.

### Aplicación

Orquesta casos de uso: crear o editar movimientos, transferir, registrar una compra, confirmar una ocurrencia recurrente, pagar deuda o actualizar una cotización. Coordina transacciones de persistencia y devuelve errores de negocio entendibles.

### Persistencia

Los repositorios exponen contratos por entidad y Dexie implementa esos contratos sobre IndexedDB. Las operaciones relacionadas —por ejemplo transferencia, compra con cuotas o importación— se ejecutan dentro de una única transacción. El esquema tiene versión explícita y migraciones incrementales.

### Presentación

React muestra datos derivados y despacha intenciones. No recalcula saldos ni contiene reglas contables. La navegación es mobile-first con barra inferior y acción central; en escritorio se transforma en sidebar y aumenta la densidad informativa.

### Integraciones

La cotización oficial se obtiene automáticamente desde DolarApi mediante un servicio desacoplado. La respuesta se valida, se conserva con fuente y fecha y se reutiliza durante seis horas. Un error de red utiliza exclusivamente la última cotización oficial válida, marcada como desactualizada. Las cotizaciones manuales históricas se conservan sólo para auditabilidad y no pueden volver a seleccionarse como valor vigente. La falta de cotización no impide registrar operaciones sin conversión.

## Flujo de escritura

1. La UI valida forma y campos requeridos.
2. El caso de uso normaliza moneda, fecha y unidades mínimas.
3. El dominio valida invariantes y construye las entidades relacionadas.
4. El repositorio persiste el conjunto transaccionalmente.
5. Las consultas derivadas vuelven a calcular saldos e indicadores.
6. La UI confirma el resultado o presenta un error accionable.

## Decisiones técnicas

| Decisión | Motivo | Consecuencia |
|---|---|---|
| Importes enteros en centavos | Evitar errores binarios | La UI convierte sólo en los bordes |
| IndexedDB mediante Dexie | Almacenamiento estructurado y transaccional | Datos ligados al navegador/dispositivo |
| Repositorios | Poder cambiar IndexedDB por un servicio remoto | Algo más de código, menor acoplamiento |
| Zod en límites | Rechazar datos corruptos de API y formularios | Validación explícita y reutilizable |
| Fechas civiles `YYYY-MM-DD` | Evitar corrimientos de zona horaria en vencimientos | Instantes técnicos siguen ISO UTC |
| Cálculos derivados | Evitar estados agregados divergentes | Las consultas deben estar indexadas |
| Compras y pagos separados | Evitar duplicar consumo al pagar tarjeta | Se distinguen consumo, pasivo y caja |

## Fechas y zona horaria

La zona funcional es `America/Argentina/Buenos_Aires`. Fechas financieras como compra, cierre y vencimiento se almacenan como fechas civiles. `createdAt` y `updatedAt` son instantes ISO. Los límites mensuales se interpretan en la zona funcional antes de consultar.

## Errores y auditabilidad

- Las operaciones fallidas no deben persistir cambios parciales.
- Los ajustes de saldo son movimientos explícitos, nunca mutaciones silenciosas.
- Las entidades conservan `createdAt`, `updatedAt` e identificadores estables.
- Una transacción histórica conserva importes y cotización aplicada.
- Archivar categorías, cuentas o tarjetas no borra su historial.
- Las eliminaciones que cambian saldos o relaciones requieren confirmación.

## Seguridad y privacidad

No se almacenan claves privadas ni credenciales de email en el frontend. La aplicación no afirma que IndexedDB sea indestructible.

## Estrategia de pruebas

- Unitarias: dominio financiero, calendario, redondeos, recurrencias y conversiones.
- Repositorios: IndexedDB en memoria, migraciones, atomicidad y reapertura.
- Integración: casos de uso con repositorios reales o dobles controlados.
- Funcionales: navegación móvil, alta de cuenta, gasto, transferencia, cuotas y filtros.
- Regresión: conjuntos financieros conocidos con resultados exactos.

## Definición de terminado por cambio

Un cambio queda terminado cuando compila, tiene pruebas proporcionales al riesgo, conserva las invariantes, funciona a 375 px y escritorio cuando aplica, y actualiza documentación si modifica contratos o reglas.
