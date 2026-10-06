# E-Commerce Application — Project Brief

## 1. Product Vision

Build a polished, commercially credible e-commerce application that demonstrates a complete modern shopping journey.

The application should feel like a real product rather than a technical demo.

The experience should prioritize:

- discovery
- speed
- trust
- clarity
- personalization
- low friction
- responsive feedback

Core principle:

> **Rich surface, simple decisions.**

The application should provide meaningful functionality without overwhelming users.

---

# 2. Product Model

Users can interact with the store before creating an account.

A guest should be able to explore the product catalog and develop shopping intent without being blocked by authentication.

Authentication should happen when it provides clear value or becomes necessary to complete an action.

Primary journey:

```text
Discover
→ Search / Browse
→ Product Details
→ Cart
→ Checkout
→ Payment
→ Order
→ Tracking
→ Retention
```

---

# 3. Guest Experience

Guests can:

- browse products
- browse categories
- search products
- filter products
- sort products
- view product details
- view reviews
- add products to cart
- remove products from cart
- update quantities
- wishlist products
- view recently viewed products
- view search history

Guests should not be forced to sign up merely to browse or build a cart.

---

# 4. Authentication

Signup should be lightweight.

Initial signup information:

- name
- email
- mobile
- password

Do not require a full address during signup.

When a guest authenticates, preserve useful shopping intent.

Where appropriate, merge:

```text
Guest Cart
Guest Wishlist
Recently Viewed
Search History
```

into the authenticated account.

Authentication should not unnecessarily destroy the user's current shopping journey.

---

# 5. Discovery

The application should support:

- homepage
- categories
- product listing
- search
- search suggestions
- filtering
- sorting
- trending/discovery sections

Search should initially support:

- keyword matching
- fuzzy matching

Natural-language / semantic search may be added later.

Example:

> comfortable headphones for a noisy office under ₹10,000

If search produces no results, provide useful alternatives rather than an empty dead end.

---

# 6. Product Details

Product pages should provide useful purchase information.

Potential information includes:

- product images
- title
- price
- discount
- availability
- variants
- description
- specifications
- reviews
- rating
- related products
- frequently bought together
- recommendations

The product page should clearly communicate the primary purchase action.

---

# 7. Cart

The cart must work for guests.

Users can:

- add products
- remove products
- change quantity
- view totals
- continue shopping
- proceed to checkout

Cart state should persist appropriately.

Authentication should not be required merely to maintain a cart.

---

# 8. Wishlist

Users can add/remove products from a wishlist.

Wishlist behavior should work for guests where practical.

After authentication, guest wishlist state should be merged into the user's account where appropriate.

---

# 9. Recently Viewed

Maintain a recently viewed product history.

Use it for:

- user convenience
- continue-shopping experiences
- personalization
- recommendations

Do not allow it to become an unbounded client-side data structure.

---

# 10. Search History

Maintain useful recent searches.

Allow users to:

- see recent searches
- repeat a search
- remove search history where appropriate

Search history may later contribute to personalization.

---

# 11. Address Management

Authenticated users can maintain multiple delivery addresses.

Each account may have:

- multiple addresses
- one default/primary address

Address entry should be optimized for usability.

A map-assisted address flow may support:

```text
Search Location
→ Select Map Position
→ Confirm
→ Refine Address Manually
```

The application should not require users to understand geographic coordinates.

---

# 12. Checkout

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

The checkout experience should minimize unnecessary steps.

Clearly display:

- items
- quantities
- prices
- discounts
- delivery cost
- taxes where applicable
- total
- selected address
- selected delivery option
- payment method

---

# 13. Payment Simulation

Payment is simulated.

No real money should be transferred.

No real card information should be stored.

The application may provide simulated:

- card payment
- QR payment
- successful payment
- failed payment
- retry flow

Example display:

```text
Visa •••• 4242
```

Use clearly fictional/demo payment behavior.

A QR payment may use a simulated payment URI such as:

```text
demo-payment://pay?orderId=ORD-123&amount=1299
```

Payment failure should preserve the user's cart and allow retry.

---

# 14. Orders

After successful payment, create an order.

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

Users should be able to view:

- order history
- order details
- products
- quantities
- totals
- payment state
- delivery address
- order status
- tracking timeline

Where appropriate, support:

- cancellation
- return
- refund

---

# 15. Inventory

Inventory belongs to the application.

The external catalog provider, if used, is not the authoritative inventory system.

Conceptually:

```text
Product
├── externalCatalogId
├── inventory
├── reserved
└── availability
```

Inventory simulation may support:

- stock adjustments
- reservation
- release
- out-of-stock
- restocking
- automatic inventory changes

Do not fake scarcity based solely on product views.

Behavioral messaging and actual inventory should remain distinct.

Example:

```text
Behavioral:
"You've been checking this out 👀"

Inventory:
"Only 3 left"
```

Only the second represents actual inventory state.

---

# 16. Store Simulation Console

Provide a minimal internal simulation interface.

This is not intended to become a full enterprise admin dashboard.

Example:

```text
Store Simulation

Inventory
Product A   Stock 3   [+] [-]
Product B   Stock 7   [+] [-]

Simulation
Auto decrease inventory   [ON]
Auto restocking           [OFF]
Interval                  60 sec

Order Simulation
Order #123
[Processing]
[Ship]
[Out for Delivery]
[Deliver]
```

The purpose is to make the commerce lifecycle demonstrable.

---

# 17. Recommendations

Start with deterministic recommendations.

Possible sources:

- related products
- category similarity
- recently viewed products
- frequently bought together
- purchase history
- wishlist behavior

Examples:

```text
Because you viewed...
Because you bought...
You may also like...
Frequently bought together...
```

AI recommendations may be introduced later.

AI must not replace deterministic business logic unnecessarily.

---

# 18. Reviews and Social Proof

Products should support reviews and ratings where appropriate.

Do not fabricate real social proof.

If reviews, purchase counts, or activity are simulated for the demo, make their simulated nature clear in the implementation.

---

# 19. Retention

Support useful retention mechanisms such as:

- continue shopping
- recently viewed
- wishlist
- abandoned cart
- price-drop notifications
- back-in-stock notifications
- meaningful order notifications

Notifications should provide actual user value.

Avoid notification spam.

---

# 20. Analytics

Track meaningful product events.

Initial event set:

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

Important funnel measurements include:

```text
Search → Product
Product → Cart
Cart → Checkout
Checkout → Payment
Payment → Purchase

Recommendation → Purchase
Wishlist → Purchase

Conversion Rate
Abandonment Rate
Repeat Purchase
Average Order Value
```

---

# 21. Application States

Important screens and asynchronous operations must account for:

### Loading

Show appropriate loading UI.

### Empty

Explain what happened and provide a useful next action.

### Error

Explain the problem in user-friendly language and provide recovery where possible.

### Offline / unavailable

Clearly communicate temporary inability to perform the requested action.

### Authentication transition

Preserve user intent wherever possible.

---

# 22. Catalog Architecture

If an external mock catalog such as DummyJSON is used, treat it as an upstream catalog source rather than the application's complete backend.

Preferred conceptual architecture:

```text
React Frontend
       ↓
Your Backend / API
       ├── External Catalog Provider
       └── Application-Owned State
             ├── Users
             ├── Inventory
             ├── Cart
             ├── Orders
             ├── Wishlist
             ├── Addresses
             └── Other application data
```

The frontend should avoid becoming tightly coupled to the external catalog provider.

The architecture may be simplified for the MVP where appropriate, but the ownership boundary should remain clear.

---

# 23. AI Strategy

AI is optional and selective.

The product should remain a strong e-commerce application even if all AI functionality is removed.

Potential AI features:

### Semantic Search

Example:

> comfortable headphones for a noisy office under ₹10,000

### Help Me Find

The user describes a need and receives relevant products.

### Personalized Recommendations

AI can augment deterministic recommendations when there is a clear benefit.

### Product Comparison

AI can summarize meaningful differences between products.

### Conversational Shopping

A later iteration may provide a conversational shopping assistant.

AI should not be inserted into:

- cart calculations
- inventory accounting
- authorization
- payment state
- order state
- deterministic validation

---

# 24. MVP Priority

## Must Have

1. Browse/search
2. Product details
3. Guest cart
4. Signup/login
5. Address management
6. Checkout
7. Simulated payment
8. Orders
9. Recently viewed
10. Wishlist
11. Search history
12. Loading/error/empty states

## Next

13. Reviews
14. Related products
15. Frequently bought together
16. Continue shopping
17. Order tracking
18. Notifications
19. Price-drop/back-in-stock
20. Improved discovery homepage

## Optional / Experimental

21. Semantic search
22. Help me find
23. Personalized recommendations
24. Product comparison
25. Conversational shopping

---

# 25. UX Philosophy

The application should feel:

- fast
- polished
- trustworthy
- intuitive
- visually rich
- commercially credible

Avoid:

- unnecessary registration walls
- excessive forms
- excessive modal dialogs
- confusing navigation
- decorative complexity
- fake urgency
- unnecessary AI
- technical implementation leaking into the UX

The guiding principle is:

> **Give users rich information while keeping the decision they need to make simple.**

---

# 26. Scope Philosophy

This is a serious frontend-focused pet project intended to demonstrate modern engineering and product thinking.

It does not need to become a production-scale Amazon clone.

Build enough depth to demonstrate:

- excellent frontend architecture
- realistic commerce flows
- good UX
- state management
- API integration
- asynchronous behavior
- testing
- simulation
- analytics
- thoughtful personalization
- selective AI exploration

Prefer depth and polish over an enormous feature checklist.
