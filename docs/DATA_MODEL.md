# Modelo de datos

El modelo es relacional en intención aunque se persista en IndexedDB. Cada entidad usa un ID estable, marcas de creación/modificación y relaciones por ID. Los nombres históricos se resuelven desde las entidades archivadas; no se borran relaciones financieras automáticamente.

## Campos compartidos

```text
id: string UUID
createdAt: ISO instant
updatedAt: ISO instant
```

Importes: entero `amountMinor`. Monedas iniciales: `ARS | USD`. Fechas civiles: `YYYY-MM-DD`.

## Entidades

### Account

`name`, `type` (`cash | bank | wallet | savings`), `currency`, `initialBalanceMinor`, `active`. El saldo actual es derivado.

### CreditCard

`name`, `issuer`, `brand`, `currency`, `closingDay`, `dueDay`, `limitMinor?`, `defaultPaymentAccountId?`, `status`.

### Category

`name`, `kind` (`income | expense`), `parentId?`, `icon`, `color`, `sortOrder`, `status`. Las subcategorías tienen un único padre del mismo tipo.

### Transaction

`date`, `amountMinor`, `currency`, `type` (`income | expense | transfer | balance-adjustment | card-payment | debt-payment`), `status`, `accountId?`, `destinationAccountId?`, `cardId?`, `categoryId?`, `description`, `notes?`, `tags[]`, `relatedId?`, `adjustmentDirection?`, `destinationAmountMinor?`, `effectiveRate?`, `feeMinor?`, `exchangeRateId?`. Para movimientos USD no-transferencia, `effectiveRate` representa ARS por USD según dólar oficial venta y, junto con `exchangeRateId`, queda inmutable después de su primera asignación.

`exchange` conserva importes de origen/destino, tasa efectiva, comisión y fuente cuando aplica. Las patas relacionadas comparten `relatedId`.

### CardPurchase

`cardId`, `purchaseDate`, `totalMinor`, `currency`, `categoryId`, `description`, `installmentCount`, `status` (`active | void`), `voidedAt?`, `voidReason?`. Es el consumo; sus cuotas representan obligaciones, no gastos adicionales.

### Installment

`purchaseId`, `number`, `totalCount`, `amountMinor`, `statementCycle`, `dueDate`, `status` (`pending | statement | paid | void`), `statementId?`, `voidedAt?`, `voidReason?`.

### CardStatement

`cardId`, `cycleStart`, `cycleEnd`, `closingDate`, `dueDate`, `currency`, `status` (`open | closed | partial | paid | void`), `totalMinor`, `paidMinor`. Los totales se recalculan desde cuotas y pagos activos; no se acumulan por mutaciones incrementales.

### CardPayment

`cardId`, `statementId`, `accountId`, `paymentDate`, `amountMinor`, `currency`, `transactionId`, `status` (`active | void`), `voidedAt?`, `voidReason?`. Puede ser parcial; no crea consumo.

### RecurringRule

`kind` (`income | expense`), `description`, `amountMinor`, `currency`, `categoryId`, `suggestedAccountId?`, `frequency`, `interval?`, `nextDate`, `endDate?`, `autoGenerate`, `active`.

### RecurringOccurrence

`ruleId`, `scheduledDate`, `effectiveDate?`, `expectedAmountMinor`, `actualAmountMinor?`, `status`, `transactionId?`. El ID estable `ruleId:scheduledDate` y el índice compuesto evitan duplicados.

### Debt

`name`, `creditor`, `principalInitialMinor`, `currency`, `dueDate?`, `annualInterestRate?`, `status`. Saldo y pagos acumulados son derivados.

### DebtPayment

`debtId`, `accountId`, `date`, `principalMinor`, `interestMinor`, `feesMinor`, `transactionId`, `status`.

### ExchangeRate

`source`, `rateType`, `buy`, `sell`, `fetchedAt`, `sourceUpdatedAt?`. `buy` y `sell` expresan ARS por USD; se validan como decimales positivos y la conversión monetaria resultante vuelve a redondearse a unidades mínimas enteras. Se conservan varias observaciones para trazabilidad.

### AppSettings

Registro único con `primaryCurrency`, `secondaryCurrency`, `locale`, `timeZone`, `rateConvention`, preferencias visuales y versión de configuración. Preferencias triviales pueden duplicarse en `localStorage`; los datos financieros no.

## Índices recomendados

- Transacciones: `date`, `type`, `status`, `currency`, `accountId`, `cardId`, `categoryId`, `relatedId`.
- Compras: `cardId + purchaseDate`, `status`.
- Cuotas: `purchaseId`, `cardId + dueDate`, `statementId`, `status`.
- Ocurrencias: `dedupeKey`, `ruleId + scheduledDate`, `status`.
- Pagos: entidad relacionada y fecha.
- Cotizaciones: `baseCurrency + quoteCurrency + fetchedAt`.

## Integridad

- Archivar es preferible a borrar entidades referenciadas.
- Fusionar categorías reasigna movimientos en una transacción y archiva la categoría origen.
- Una compra con cuotas y todas sus obligaciones se escribe atómicamente.
- Un pago y su salida de fondos se escribe atómicamente.
- Una transferencia escribe origen y destino atómicamente.
- Anular conserva los registros relacionados y los marca `void`; nunca borra físicamente historia de tarjeta.
- Una compra con pagos activos no puede editarse ni anularse hasta revertir esos pagos.
- Editar una compra anula su cronograma anterior, genera otro exacto y recalcula todos los resúmenes afectados en una transacción.

## Versión y migraciones

Las migraciones de Dexie sólo avanzan y transforman registros de forma determinista. Cada versión documenta campos nuevos, valores por defecto y prueba una apertura desde la versión previa. La versión 6 incorpora estados auditables de compras y pagos; migra los registros de v5 como `active` y preserva movimientos existentes como `confirmed`.
