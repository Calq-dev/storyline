# Implementation Changeset — Annotated Format Example

This shows the structure of a well-formed implementation changeset for a feature. The changeset is a YAML file in `.storyline/changesets/CS-YYYY-MM-DD-<slug>.yaml`.

## Scenario Execution Order

The walking skeleton comes first — the simplest end-to-end path that establishes core infrastructure:

```
### Walking Skeleton: "Customer places order with single item"
Priority: must-have | Aggregates: Order | Events: OrderPlaced
Why first: simplest end-to-end path, establishes Order aggregate and basic infrastructure

### Scenario 2: "Customer places order with multiple items"
Priority: must-have | Aggregates: Order | Events: OrderPlaced
Why next: extends walking skeleton with OrderLine collection logic

### Scenario 3: "Unauthenticated user cannot place order"
Priority: must-have | Aggregates: Order | Events: none (validation error)
Why here: adds auth guard, builds on established Order infrastructure
```

## Component Inventory

Derived from `bounded_contexts[].aggregates[]` in the blueprint. Every component that needs to be created or modified:

| Component | Type | Scenarios | Events | Invariants | Path |
|---|---|---|---|---|---|
| Order | Aggregate Root | S1, S2, S3 | OrderPlaced, OrderConfirmed | total = sum(lines), min 1 item | src/ordering/domain/order.ts |
| OrderLine | Entity | S2, S3 | — | quantity > 0, price > 0 | src/ordering/domain/order-line.ts |
| Money | Value Object | S1-S6 | — | amount ≥ 0, valid currency | src/ordering/domain/money.ts |
| PlaceOrderHandler | Command Handler | S1, S2 | triggers OrderPlaced | validates cart not empty | src/ordering/application/place-order.ts |
| OrderRepository | Interface | S1-S6 | — | — | src/ordering/domain/order-repository.ts |
| InMemoryOrderRepository | Test impl | S1-S6 | — | — | tests/ordering/infra/in-memory-order-repo.ts |

## Dependency Graph

Derived from `relationships[]` and command/event chains in the blueprint. Determines inner-loop build order:

```
PlaceOrderHandler
  ├── Order (aggregate)
  │   ├── OrderLine (entity)
  │   ├── Money (value object)
  │   └── OrderId (value object)
  ├── OrderRepository (interface)
  └── OrderPlaced (event)
```

**Build order for walking skeleton** (no-dependency components first):
1. Money (value object — no dependencies)
2. OrderId (value object — no dependencies)
3. OrderLine (entity — depends on Money)
4. Order (aggregate — depends on OrderLine, Money, OrderId)
5. OrderPlaced (event — depends on Order)
6. OrderRepository (interface — depends on Order)
7. InMemoryOrderRepository (test impl — depends on OrderRepository)
8. PlaceOrderHandler (handler — depends on all above)

## Integration Points

Derived from `bounded_contexts[].relationships[]`:

```
Ordering → Payment: OrderPlaced event triggers PaymentRequested command
  Relationship type: Published Language
  ACL needed: Payment context maps OrderPlaced to its own PaymentInitiated
```

## Test Strategy

For each scenario:

```
### Walking Skeleton
Acceptance test: Cucumber step definitions calling PlaceOrderHandler directly
Unit tests:
  - Order.place() — invariant validation
  - Money arithmetic
  - OrderLine validation
Mocks: OrderRepository (in-memory fake — implements the interface)
Traceability: PlaceOrder command links to order-placement.feature (verified in blueprint)
```

## Risk Spots

```
⚠️ GAP-001: [description from blueprint gaps[]] — affects [context]
❓ Q-001: [open question from blueprint questions[]] — resolve before implementing [component]
```
