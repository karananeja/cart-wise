# MVP Requirements Catalogue

Derived from `PROJECT_BRIEF.md`. IDs are stable. "Feature" is the planned feature in `project-plan.md`.

## Discovery — F-001

| ID | Requirement | Source |
|---|---|---|
| DISC-1 | Homepage with category entry points and factual discovery sections | Brief §5 |
| DISC-2 | Browse products by category | §3, §5 |
| DISC-3 | Product listing with filters | §3, §5 |
| DISC-4 | Product listing with sorting | §3, §5 |
| DISC-5 | Listing state (filters, sort, page) is shareable and survives back/forward | §25 (low friction) |

## Search — F-002

| ID | Requirement | Source |
|---|---|---|
| SRCH-1 | Keyword search across products | §5 |
| SRCH-2 | Fuzzy matching (typo tolerance) | §5 |
| SRCH-3 | Search suggestions while typing | §5 |
| SRCH-4 | No-results state offers useful alternatives | §5 |
| HIST-1 | Recent searches shown, repeatable, removable; bounded size | §10 |

## Product details and recently viewed — F-003

| ID | Requirement | Source |
|---|---|---|
| PDP-1 | Images, title, price, discount, availability, description, specifications, rating | §6 |
| PDP-2 | One clear primary purchase action | §6 |
| PDP-3 | Variants where the catalog supports them (see Q4) | §6 |
| RV-1 | Recently viewed list, bounded, used for continue-shopping | §9 |

## Cart — F-004

| ID | Requirement | Source |
|---|---|---|
| CART-1 | Guests can add, remove, change quantity | §7 |
| CART-2 | Totals visible | §7 |
| CART-3 | Cart persists across reloads without authentication | §7 |
| CART-4 | Quantities respect application inventory | §15 |

## Wishlist — F-005

| ID | Requirement | Source |
|---|---|---|
| WISH-1 | Add / remove wishlist items as guest | §8 |
| WISH-2 | Move between wishlist and cart | §8 (implied) |

## Authentication — F-006

| ID | Requirement | Source |
|---|---|---|
| AUTH-1 | Signup with name, email, mobile, password — no address | §4 |
| AUTH-2 | Login / logout | §4 |
| AUTH-3 | Merge guest cart, wishlist, recently viewed, search history on sign-in | §4 |
| AUTH-4 | Authentication resumes the action that triggered it | §4, §21 |

## Addresses — F-007

| ID | Requirement | Source |
|---|---|---|
| ADDR-1 | Multiple addresses, one default | §11 |
| ADDR-2 | Usability-optimised entry; optional map-assisted flow (see Q7) | §11 |

## Checkout — F-008

| ID | Requirement | Source |
|---|---|---|
| CHK-1 | Cart → Auth if needed → Address → Delivery → Summary → Payment → Confirmation | §12 |
| CHK-2 | Summary shows items, quantities, prices, discounts, delivery, taxes, total, address, delivery option, payment method | §12 |
| CHK-3 | Stock is reserved during checkout and released on abandonment/failure (see Q10) | §15 |

## Payment — F-009

| ID | Requirement | Source |
|---|---|---|
| PAY-1 | Simulated card and QR payment | §13 |
| PAY-2 | Deterministic success and failure paths, retry | §13 |
| PAY-3 | Failure preserves cart | §13 |
| PAY-4 | No real card data stored; masked display only | §13 |
| PAY-5 | **Card offers:** simulated bank/card offers (e.g. instant discount for a card type, with minimum order and cap). The product page shows a banner naming the card with the best offer for that product's price; offers apply at payment | User request 2026-10-06 |
| PAY-6 | **UPI (simulated):** pay by UPI ID (collect request approved in a simulated UPI app screen) or UPI QR, with success, failure and timeout paths | User request 2026-10-06 |

## Orders — F-010

| ID | Requirement | Source |
|---|---|---|
| ORD-1 | Order created after successful payment | §14 |
| ORD-2 | Order history and details | §14 |
| ORD-3 | Lifecycle states per brief | §14 |
| ORD-4 | Cancellation, return, refund where appropriate (see Q9) | §14 |
| ORD-5 | **Delivery OTP:** when an order is about to be delivered, a one-time code is shown to the customer and must be entered in the simulated delivery step before the order can be marked Delivered (see Q16) | User request 2026-10-06 |

## Inventory — cross-cutting (F-001 onward)

| ID | Requirement | Source |
|---|---|---|
| INV-1 | Inventory owned by the application, separate from catalog data | §15, §22 |
| INV-2 | Reservation and release | §15 |
| INV-3 | Out-of-stock and low-stock states reflect real application inventory only | §15 |

## Store Simulation Console — F-011

| ID | Requirement | Source |
|---|---|---|
| SIM-1 | Adjust stock per product | §16 |
| SIM-2 | Toggle automatic inventory decrease / restocking with interval | §16 |
| SIM-3 | Advance an order through its lifecycle | §16 |
| SIM-4 | Delivering an order requires entering the customer's delivery OTP (ORD-5) | User request 2026-10-06 |

## Cross-cutting

| ID | Requirement | Source |
|---|---|---|
| STATE-1 | Loading, empty, error, offline states for every async surface | §21 |
| STATE-2 | Authentication transitions preserve intent | §21 |
| ANL-1 | Track the event set in brief §20 | §20 |
| ANL-2 | Events stored so funnels can be computed locally | §20 |
