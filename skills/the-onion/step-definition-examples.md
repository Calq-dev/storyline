# Step Definition Examples

Declarative step definitions — describe business actions, not UI interactions.
Detect language + framework from `tech_stack` in the blueprint.

## TypeScript / Cucumber.js

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { World } from './support/world';

Given('a registered customer {string}', async function(this: World, customerName: string) {
  this.customer = await this.createCustomer({ name: customerName });
});

When('the customer places an order for {int} x {string}',
  async function(this: World, quantity: number, productName: string) {
    const product = await this.findProduct(productName);
    this.result = await this.placeOrder({
      customerId: this.customer.id,
      items: [{ productId: product.id, quantity }]
    });
  }
);

Then('the order should be confirmed with total {string}',
  async function(this: World, expectedTotal: string) {
    expect(this.result.status).toBe('confirmed');
    expect(this.result.total.toString()).toBe(expectedTotal);
  }
);
```

Write to: `tests/acceptance/steps/<feature>_steps.ts`

## Python / Behave

```python
from behave import given, when, then

@given('a registered customer "{name}"')
def step_registered_customer(context, name):
    context.customer = create_customer(name=name)

@when('the customer places an order for {quantity:d} x "{product}"')
def step_place_order(context, quantity, product):
    product = find_product(product)
    context.result = place_order(
        customer_id=context.customer.id,
        items=[{"product_id": product.id, "quantity": quantity}]
    )

@then('the order should be confirmed with total "{expected_total}"')
def step_order_confirmed(context, expected_total):
    assert context.result.status == "confirmed"
    assert str(context.result.total) == expected_total
```

Write to: `tests/acceptance/steps/<feature>_steps.py`

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

## Walking Skeleton Wire-Up

```
HTTP Request → Controller → Command Handler → Domain → Repository → Database
```

Typical walking skeleton setup:
1. Read `tech_stack` from blueprint — language, framework, test runner already known
2. Generate: entry point (route/controller), command handler, domain aggregate, repository interface, in-memory repository
3. Wire with dependency injection (or manual wiring)
4. Run acceptance test — should pass for the simplest case
