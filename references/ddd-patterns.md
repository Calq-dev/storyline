# DDD Patterns Quick Reference

Use this as a reference when modeling. Read the relevant section based on what you're working on.

## Strategic Patterns (Bounded Contexts)

### Context Mapping Patterns

**Shared Kernel**
Two contexts share a small subset of the domain model. Both teams must agree on changes.
- Use when: Two contexts are tightly coupled on a small piece
- Risk: Changes affect both teams; keep the kernel minimal
- Example: Both Order and Invoice share the `Money` value object

**Customer-Supplier**
Upstream context (supplier) provides what downstream (customer) needs. The supplier plans with the customer's needs in mind.
- Use when: One context depends on another and they can coordinate
- Example: Product Catalog (supplier) provides product data to Ordering (customer)

**Conformist**
Downstream context accepts the upstream's model without translation.
- Use when: You have no influence over the upstream model (3rd party API)
- Risk: Your model is shaped by someone else's decisions
- Example: Using Stripe's payment model as-is in your Payment context

**Anti-Corruption Layer (ACL)**
A translation layer that protects your model from an external or legacy model.
- Use when: The upstream model is messy, legacy, or fundamentally different from yours
- Implementation: Adapter + Translator classes at the boundary
- Example: Legacy billing system → ACL → Clean Payment aggregate

**Published Language**
A shared, documented language (often event schemas) for integration.
- Use when: Multiple contexts need to communicate via events
- Implementation: Shared event schema definitions (JSON Schema, Protobuf, Avro)
- Example: OrderPlaced event schema published for Payment and Shipping contexts

**Open Host Service**
A well-defined API/protocol that other contexts can integrate with.
- Use when: Multiple downstream contexts need your data
- Implementation: REST API, GraphQL, gRPC with documented contracts
- Example: Product Catalog exposes a search API used by multiple contexts

**Separate Ways**
No integration at all. Contexts are independent.
- Use when: The cost of integration exceeds the benefit
- Example: Marketing analytics and User Authentication have no shared concerns

## Tactical Patterns (Within a Bounded Context)

### Aggregate

A cluster of domain objects treated as a single unit for data changes. Has a root entity.

**Rules:**
- External references only point to the aggregate root (never to internal entities)
- Changes within the aggregate are transactionally consistent
- Changes across aggregates are eventually consistent
- Keep aggregates small — prefer many small ones over few large ones

**Sizing heuristic:** If you find yourself needing to lock multiple aggregates in one transaction, either they should be one aggregate, or you need a saga/process manager.

### Entity

An object with a distinct identity that runs through time. Two entities with the same attributes but different IDs are different.

**When to use:** The object has a lifecycle, changes state, and needs to be tracked individually.
**Identity:** Use a generated ID (UUID), not a natural key. Natural keys change.

### Value Object

An object defined entirely by its attributes. Two value objects with the same attributes are equal. Immutable.

**When to use:** The concept has no identity, only values. This is *most* of your domain objects.
**Common examples:** Money, Email, Address, DateRange, Percentage, Quantity, Color, Coordinates

**Implementation pattern:**
```
class Money:
    amount: Decimal
    currency: Currency

    def add(other: Money) -> Money:
        assert self.currency == other.currency
        return Money(self.amount + other.amount, self.currency)

    def equals(other) -> bool:
        return self.amount == other.amount and self.currency == other.currency
```

### Domain Event

Something that happened in the domain that domain experts care about. Named in past tense.

**Naming:** `[Noun][PastTenseVerb]` — OrderPlaced, PaymentReceived, UserRegistered
**Content:** Carry all data needed for consumers to react without querying back
**Immutable:** Once published, never modified

### Domain Service

An operation that doesn't naturally belong to any entity or value object.

**When to use:** The operation involves multiple aggregates or requires external data.
**When NOT to use:** If it can live on an entity or value object, put it there first.
**Example:** PricingService (needs product catalog + discount rules + tax tables)

### Repository

Provides the illusion of an in-memory collection of aggregates.

**Interface:** Defined in the domain layer (only interface, no implementation details)
**Implementation:** In the infrastructure layer (database, API, file system, etc.)
**Pattern:** One repository per aggregate root

### Factory

Encapsulates complex aggregate creation logic.

**When to use:** Creating an aggregate requires multiple steps, validations, or external data.
**When NOT to use:** If a simple constructor or static factory method suffices.

## Process Manager / Saga

Coordinates a long-running business process that spans multiple aggregates or contexts.

**When to use:** A business process requires multiple steps across boundaries with compensation on failure.
**Example:** Order fulfillment: OrderPlaced → reserve stock → charge payment → arrange shipping. If payment fails, release stock.

**Implementation:** A state machine that listens for events and issues commands:
```
State: AWAITING_PAYMENT
  on PaymentConfirmed → issue ArrangeShipment, transition to AWAITING_SHIPMENT
  on PaymentFailed → issue ReleaseStock, transition to CANCELLED
```
