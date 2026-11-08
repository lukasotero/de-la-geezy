# Reglas financieras

Este documento es la especificación del motor. Ante una diferencia con la presentación, prevalecen estas reglas y sus pruebas.

## Convenciones

- `amountMinor`: entero no negativo en la unidad mínima de la moneda.
- `ARS 1.234,56` se representa como `123456`.
- El sentido económico lo determina el tipo de movimiento, no el signo ingresado.
- ARS y USD usan dos decimales en el MVP.
- Las fechas financieras son civiles (`YYYY-MM-DD`).
- Sólo registros `confirmed` alteran saldos; `pending`, `skipped` y `void` no lo hacen.

## Saldo de cuenta

Para una cuenta y moneda:

```text
saldo confirmado = saldo inicial
  + ingresos confirmados
  + transferencias recibidas confirmadas
  + ajustes positivos confirmados
  - gastos pagados desde la cuenta confirmados
  - transferencias enviadas confirmadas
  - pagos de deuda o tarjeta confirmados
  - ajustes negativos confirmados
  - comisiones debitadas confirmadas
```

El saldo inicial no es ingreso del período. Un pendiente no cambia el saldo.

## Ingresos y gastos

- Ingreso real: entrada externa confirmada con fecha dentro del período.
- Gasto por consumo: compra o gasto confirmado atribuido a su fecha de consumo.
- Una transferencia interna nunca es ingreso ni gasto.
- Un ajuste corrige un saldo y se reporta por separado, salvo que el usuario lo reclasifique explícitamente.
- Intereses, comisiones e impuestos son gasto; devolución de capital no lo es.

## Tarjetas de crédito

Una compra registra consumo en la fecha de compra y crea pasivo. No reduce una cuenta líquida hasta el pago. Un pago de resumen reduce fondos y pasivo, pero no agrega gasto de consumo.

```text
deuda total tarjeta = compras y cargos confirmados
  - pagos aplicados
  - notas de crédito
  - anulaciones
```

El próximo resumen exigible incluye obligaciones asignadas a ese ciclo menos pagos aplicados, no toda la deuda futura.

### Corrección y anulación

- Editar una compra reemplaza su cronograma completo: las cuotas anteriores quedan `void` y el nuevo cronograma debe sumar exactamente el total corregido.
- La moneda de una compra siempre deriva de su tarjeta. Cambiar de tarjeta traslada las obligaciones y recalcula los resúmenes de ambas tarjetas.
- Una compra no puede editarse ni anularse mientras cualquiera de sus resúmenes tenga pagos activos.
- Anular un pago marca también `void` su movimiento de caja, resta su importe pagado y reabre el resumen y sus cuotas cuando corresponde.
- Anular una compra marca `void` el consumo y todas sus cuotas. Los resúmenes sin obligaciones activas quedan `void`.
- Los totales de un resumen se derivan siempre de cuotas y pagos activos; nunca dependen de una suma incremental previa.
- `voidedAt` y `voidReason` conservan trazabilidad. Los registros `void` sólo aparecen al pedir historial anulado y no afectan saldo, consumo, deuda, proyección ni análisis.

## Cuotas y redondeo

Para `totalMinor` y `n` cuotas:

```text
base = floor(totalMinor / n)
resto = totalMinor mod n
cuota[i] = base + 1 para las primeras "resto" cuotas; base para las demás
```

Así todas difieren como máximo una unidad mínima y la suma es exactamente `totalMinor`. Corregir un cronograma debe mantener esa igualdad.

## Ciclos de cierre y vencimiento

La compra se asigna al primer cierre que, según la convención configurada, todavía admite la fecha de compra. El vencimiento se calcula desde ese ciclo y se muestra para revisión antes de confirmar cuotas. Si el día configurado no existe en un mes, se usa su último día válido.

## Transferencias

Una transferencia en la misma moneda contiene dos patas relacionadas y su suma patrimonial neta es cero, excepto comisión explícita. Entre monedas se guardan:

- importe y moneda de origen;
- importe y moneda de destino;
- tasa efectiva usada;
- comisión y cuenta que la soportó;
- identificador común.

La tasa efectiva es un dato histórico inmutable. La cotización actual sólo sirve para valuación de referencia.

## Recurrencias

Cada regla y fecha programada define una clave única de ocurrencia. Reconciliar varias veces produce como máximo una ocurrencia por clave. La ocurrencia nace `pending`, no descuenta fondos y puede confirmarse con el importe real, omitirse o reprogramarse. Día 29, 30 o 31 inválido se ajusta al último día del mes.

## Deudas

```text
saldo de capital = capital inicial
  + capital nuevo
  - pagos aplicados a capital
```

Intereses devengados y pagos de intereses se registran por separado. El patrimonio resta capital pendiente y otras obligaciones vigentes.

## Conversiones y cotizaciones

- Todo movimiento USD que participa en análisis conserva como snapshot inmutable la cotización oficial de venta disponible al registrarse o reconciliarse por primera vez.
- Una operación USD sin cotización puede guardarse, pero queda fuera de agregados ARS hasta recibir su primer snapshot.
- Las nuevas cotizaciones sólo completan snapshots faltantes; nunca revalorizan operaciones históricas.
- Todas las conversiones de referencia usan exclusivamente la cotización oficial de venta.
- La valuación actual puede usar la última cotización válida, con fecha y fuente visibles.
- Nunca se reescribe el valor histórico con una cotización nueva.
- Si no existe cotización válida, no se calcula un total combinado: se muestran saldos por moneda.

## Indicadores formales

Todos los indicadores se calculan por período y moneda salvo aclaración.

| Indicador | Incluye | Excluye |
|---|---|---|
| Saldo líquido | Saldos confirmados de cuentas activas y archivadas con saldo | Límite de tarjeta, pendientes |
| Ingresos del mes | Entradas externas confirmadas por fecha efectiva | Saldo inicial, transferencias, ajustes, ingresos futuros |
| Gastos del mes | Consumos confirmados por fecha de compra o gasto | Transferencias, pagos de tarjeta, devolución de capital |
| Resultado mensual | Ingresos del mes menos gastos del mes | Saldo inicial y variación por cotización |
| Deuda exigible | Obligaciones vencidas o del próximo resumen | Cuotas de ciclos posteriores |
| Deuda total | Capital y obligaciones pendientes | Intereses futuros no devengados |
| Patrimonio neto | Activos valorizados menos pasivos vigentes | Límites |
| Dinero libre | Saldo líquido menos compromisos confirmados próximos | Patrimonio no líquido y fondos ya asignados |
| Tasa de ahorro | `(ingresos - gastos) / ingresos` si ingresos > 0 | Transferencias y revaluaciones |
| Saldo proyectado | Saldo real + entradas futuras previstas - compromisos previstos | Hechos sin fecha o sin importe |

## Invariantes obligatorias

1. No hay doble contabilización entre compra, pasivo y pago.
2. La suma de cuotas coincide exactamente con la compra.
3. Una transferencia confirmada persiste ambas patas o ninguna.
4. Un pendiente no modifica saldo.
5. Reconciliar recurrencias es idempotente.
6. Historial y cotizaciones aplicadas son trazables.
7. Saldos se recalculan después de toda escritura válida.
