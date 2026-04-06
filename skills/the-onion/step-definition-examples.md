# Step Definition Examples

Detect language + framework from `tech_stack` in the blueprint. Write **declarative** step definitions — business actions, not UI interactions. Write to: `tests/acceptance/steps/<feature>_steps.*`

## Traceability Comments

Add to command handlers to maintain feature-to-code traceability:

```typescript
/**
 * Handles the PlaceOrder command.
 *
 * Implements behavior from:
 * - features/order-placement.feature: "Customer places order with single item"
 * - features/order-placement.feature: "Customer places order with multiple items"
 *
 * Domain events produced: OrderPlaced
 * Invariants enforced: see Order aggregate
 */
export class PlaceOrderHandler { ... }
```

This lets anyone trace a line of code back to a Gherkin scenario back to a business requirement.
