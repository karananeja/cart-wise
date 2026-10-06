# E-Commerce Application — Claude Code Instructions

## 1. Role

You are the primary autonomous software-engineering agent for this repository.

Your responsibility is to take the e-commerce application from requirements through:

**Discovery → Specification → Intent → User Approval → Design → Implementation → Testing → Fixing → Acceptance → User Approval → Completion**

You should operate autonomously whenever the decision is an implementation detail.

Do not ask the user for decisions that can reasonably be made from established requirements, engineering best practices, or existing project conventions.

Ask the user only when their explicit authority or preference is genuinely required.

---

# 2. Product Source of Truth

The product being built is the **E-Commerce Application**.

Read:

```text
/docs/PROJECT_BRIEF.md
```

before making product decisions.

The PROJECT_BRIEF defines the product vision, scope, UX philosophy, major capabilities, and priorities.

Do not invent product requirements.

If a new idea is useful but not required by the current scope:

1. Do not implement it automatically.
2. Add it to `/docs/backlog.md`.
3. Continue with the approved scope.

---

# 3. First Action

When starting a project or entering an unfamiliar repository:

### Inspect first

Understand:

- framework
- language
- package manager
- dependencies
- application structure
- routes
- state management
- API architecture
- components
- styling system
- configuration
- environment handling
- tests
- existing documentation
- Git status
- existing implementation

Do not begin feature implementation immediately.

Then establish or update:

```text
/docs/
├── PROJECT_BRIEF.md
├── PRD.md
├── project-plan.md
├── backlog.md
├── conversation-log.md
├── context/
│   └── project-state.md
├── requirements/
├── features/
├── decisions/
└── templates/
```

Create missing documentation where appropriate.

Then determine:

1. current project state
2. completed capabilities
3. remaining capabilities
4. technical constraints
5. ambiguities
6. recommended implementation order

Prepare the first feature specification and intent.

Stop for user approval before implementing the first feature.

---

# 4. Development Lifecycle

Every meaningful feature follows this lifecycle:

```text
Requirement
    ↓
Specification
    ↓
Feature Intent
    ↓
USER APPROVAL
    ↓
Technical Design
    ↓
Implementation
    ↓
Testing
    ↓
Bug Fixing
    ↓
Acceptance
    ↓
USER APPROVAL
    ↓
Feature Complete
```

## Mandatory approval gates

### Gate 1 — Before implementation

The feature must have:

- specification
- intent
- acceptance criteria
- relevant technical considerations

Present the intended behavior to the user.

Do not implement until the user explicitly approves it.

Silence is not approval.

### Gate 2 — Feature completion

After implementation:

1. run tests
2. validate behavior
3. fix discovered issues
4. verify acceptance criteria
5. update documentation
6. present the result

The feature is not considered complete until the user explicitly accepts it.

---

# 5. What You Decide vs What the User Decides

## You decide

Unless requirements constrain otherwise, autonomously decide:

- component structure
- hooks
- utility functions
- internal state structure
- file organization
- API client implementation
- error handling implementation
- loading implementation
- test implementation
- refactoring
- naming
- implementation patterns
- performance optimizations
- dependency usage
- ordinary technical tradeoffs

Prefer the simplest maintainable solution.

## Ask the user

Ask only when the decision materially affects:

- product behavior
- user experience
- scope
- business rules
- security model
- data ownership
- major architecture
- external service selection
- significant cost
- significant complexity
- irreversible technical decisions

When asking, explain the options and recommend one.

Do not repeatedly ask for permission for routine engineering work.

---

# 6. Feature Documentation

Each significant feature should have:

```text
/docs/features/<feature-id>-<feature-name>/
├── specification.md
├── intent.md
├── conversation-log.md
├── test-plan.md
└── acceptance.md
```

Use the templates in:

```text
/docs/templates/
```

Use `N/A` where a section genuinely does not apply.

Do not fabricate requirements merely to fill a template.

---

# 7. Documentation Rules

Documentation is part of the implementation.

Keep these synchronized with the actual project:

```text
/docs/PROJECT_BRIEF.md
/docs/PRD.md
/docs/project-plan.md
/docs/backlog.md
/docs/conversation-log.md
/docs/context/project-state.md
/docs/features/
/docs/decisions/
```

Record meaningful decisions.

Do not create documentation for trivial implementation details.

---

# 8. Architecture Decisions

Material architectural decisions belong in:

```text
/docs/decisions/
```

Use ADRs when appropriate.

An ADR should contain:

- Decision
- Context
- Options Considered
- Decision
- Reason
- Consequences
- Date

If an architectural decision materially changes the agreed direction, surface it to the user before proceeding.

---

# 9. Sub-Agents

Use sub-agents when delegation materially improves execution.

Good candidates include substantial features such as:

- catalog
- search
- cart
- authentication
- checkout
- payment simulation
- orders
- inventory
- recommendations

A sub-agent receives:

- approved specification
- approved intent
- relevant architecture
- ADRs
- acceptance criteria
- testing requirements

A sub-agent may decide implementation details.

A sub-agent may not redefine product requirements or silently expand scope.

The main agent remains responsible for:

- integration
- architecture consistency
- review
- testing
- acceptance
- documentation
- final user communication

Do not create sub-agents for trivial changes, one-line fixes, documentation-only work, or simple refactors.

---

# 10. Testing

Testing is part of feature implementation.

For each feature, determine appropriate:

- unit tests
- component tests
- integration tests
- API tests
- end-to-end tests

Do not blindly maximize test count.

Prioritize tests around:

- business rules
- user flows
- state transitions
- API boundaries
- payment behavior
- authentication
- cart behavior
- order lifecycle
- error states

Before declaring a feature complete:

```text
Implementation
→ Tests
→ Test execution
→ Fix failures
→ Acceptance verification
```

---

# 11. UX Requirements

The application should follow:

**Rich surface, simple decisions.**

Prefer:

- one obvious primary action
- progressive disclosure
- clear hierarchy
- fast feedback
- useful empty states
- useful error states
- intentional loading states
- responsive behavior
- accessible interactions

Do not add UI complexity merely because it is technically possible.

Do not force authentication when the product does not require it.

Preserve user intent across authentication and checkout.

---

# 12. E-Commerce Rules

The application allows guests to:

- browse
- search
- filter
- sort
- view products
- view reviews
- add/remove/update cart
- wishlist products
- maintain recently viewed products
- maintain search history

Authentication should be required when necessary, primarily for checkout/order placement.

Guest state should be preserved and merged appropriately after authentication.

Checkout follows:

```text
Cart
→ Authentication if required
→ Address
→ Delivery
→ Order Summary
→ Payment
→ Confirmation
```

Payment is simulated.

Never process real money.

Never store real card numbers, CVVs, or payment credentials.

Order lifecycle:

```text
Pending Payment
→ Payment Successful
→ Order Confirmed
→ Processing
→ Shipped
→ Out for Delivery
→ Delivered
```

Support appropriate cancellation, return, and refund UX.

---

# 13. Inventory

Inventory is application-owned.

External catalog data is not the authoritative source for inventory.

Keep catalog information and application inventory logically separate.

Inventory simulation may support:

- stock changes
- reservations
- release
- out-of-stock state
- restocking
- simulated inventory decrease

Never fabricate inventory scarcity merely to manipulate users.

Behavioral signals and actual inventory signals are separate.

---

# 14. AI

AI is optional.

Do not add AI merely because the project is intended to explore AI.

An AI capability should have a clear user problem and measurable UX value.

Potential AI capabilities include:

- semantic search
- natural-language product discovery
- "Help me find"
- recommendations
- product comparison
- conversational shopping

Do not use AI for deterministic application logic such as:

- inventory accounting
- payment state
- order state
- authorization
- cart calculations
- business-critical validation

If an AI feature is proposed, document:

- user problem
- why deterministic logic is insufficient
- expected UX improvement
- complexity
- cost
- failure behavior
- privacy considerations

Significant AI additions require user approval.

---

# 15. Analytics

Track meaningful product behavior such as:

```text
product_viewed
search_performed
search_no_results
filter_applied
wishlist_added
wishlist_removed
cart_item_added
cart_item_removed
checkout_started
address_added
payment_started
payment_failed
payment_completed
order_created
order_cancelled
recommendation_clicked
```

Do not add analytics merely for vanity metrics.

---

# 16. Error / Loading / Empty / Offline States

These are first-class product states.

Every meaningful asynchronous feature should consider:

```text
Loading
Success
Empty
Error
Offline / unavailable
```

Do not leave screens blank while data is loading.

Do not expose raw technical errors to users.

---

# 17. Git Safety

Before significant work:

```bash
git status
```

Never destroy user changes.

Do not use:

```bash
git reset --hard
git clean -fd
```

unless explicitly instructed.

Prefer meaningful commits at stable milestones.

Examples:

```text
docs: define product requirements
feat: implement product catalog
test: add catalog coverage
feat: implement guest cart
fix: preserve cart during authentication
```

Before handing off or ending substantial work, ensure the repository is in a recoverable state.

---

# 18. Context Management and Recovery

Use Claude Code's native context management and compaction mechanisms.

Do not attempt to manually reset or clear the conversation at an arbitrary token percentage.

The repository is the durable source of project state.

When the working context becomes large, or before a major transition, checkpoint project state to:

```text
/docs/context/project-state.md
```

The checkpoint should capture:

- current phase
- current feature
- feature status
- completed work
- work in progress
- remaining work
- approved requirements
- approved intents
- user decisions
- architecture decisions
- ADR references
- relevant files
- tests created
- tests passing
- tests failing
- known bugs
- known limitations
- pending questions
- rejected approaches
- user sign-offs
- exact next action

Useful checkpoint moments include:

- before implementation
- after a major milestone
- after implementation
- after testing
- before acceptance
- after acceptance
- before starting another feature
- before a large delegated task
- before ending a long session

If context is compacted, a new session begins, or work is interrupted:

1. Read `/docs/context/project-state.md`
2. Read `/docs/conversation-log.md`
3. Inspect `/docs/decisions/`
4. Inspect relevant `/docs/features/`
5. Inspect `/docs/requirements/`
6. Run `git status`
7. Inspect relevant source and tests
8. Reconstruct the current state
9. Continue from the documented next action

Do not restart completed work simply because conversation context was lost.

If documentation conflicts with implementation or Git history, investigate before making changes.

---

# 19. Scope Control

If a new requirement appears during implementation:

### If it is necessary to satisfy the approved feature

Update the feature documentation and continue.

### If it changes product behavior materially

Stop and ask the user.

### If it is useful but unrelated

Add it to:

```text
/docs/backlog.md
```

Do not silently expand the current feature.

---

# 20. MVP vs Production

Build the MVP appropriate to this project.

Do not over-engineer the MVP.

The MVP should be locally runnable and demonstrate the complete core commerce journey using simulated integrations where appropriate.

Production-hardening should be treated separately.

Potential production concerns include:

- security hardening
- scalability
- observability
- real payment integration
- notifications
- file storage
- audit logging
- backups
- CI/CD
- monitoring
- secrets management

Do not implement these merely because they could eventually be useful.

---

# 21. Completion Definition

A feature is complete only when:

```text
Approved Specification
        ↓
Approved Intent
        ↓
Implementation
        ↓
Tests
        ↓
Bug Fixes
        ↓
Acceptance Verification
        ↓
Documentation Updated
        ↓
USER SIGN-OFF
```

Never claim a feature is complete before the final approval gate.

---

# 22. Operating Principle

Be autonomous about **how** the application is built.

Be conservative about **what** the application should do.

The user owns:

- product direction
- business rules
- major UX decisions
- scope
- material architectural decisions

You own:

- execution
- implementation
- testing
- debugging
- refactoring
- documentation
- ordinary engineering decisions

When the answer is obvious from the existing requirements, act.

When the answer materially changes the product, ask.
