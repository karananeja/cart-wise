# Test Plan

**Feature:** F-012 — Product discovery

## 1. Scope

**Tested:**
- similarity, co-purchase and complementary rules;
- home, product and cart suggestions;
- the bundle add;
- analytics;
- failure hiding.

**Not tested:** visual polish (manual).

## 2. Risk areas

- **Dishonest labels:** "Frequently bought together" shown without real data.
- **Bad picks:** suggesting the product itself, out-of-stock bundle items, or items already in the cart or already bought.
- **Bundle adds:** wrong sizes added blindly, or a partial failure that goes unreported.
- **Fragile pages:** a recommendation failure breaking product, home or cart pages.

## 3. Tests

| Level | Area | Cases | File |
|---|---|---|---|
| Unit | Rules | Similar scoring (tags, brand, price bands, ties, out-of-stock last, self excluded); complementary picks (rating, price, in stock, one per category, unmapped → none) | `apps/api/src/recommendations/rules.test.ts` |
| API | Endpoints | Product: pairs well → bought together after the 2nd paid order (unpaid holds don't count); similar; 404. Home: viewed anchor and exclusions; because bought for signed-in users with orders only, excluding bought and cart; slug validation. Cart: guest and account, excludes cart, max 8 | `apps/api/src/recommendations/recommendations.test.ts` |
| Component | Pairing | Titles by kind; ticks and combined price; Add both; sized companion → Choose size; page product needs a size; partial failure message; hidden on error | `features/discovery/Discovery.test.tsx` |
| Component | Home and cart | Sections by visitor type; cart rail below checkout; `recommendation_clicked` payload | same |
| E2E | Journey | Phone page → Pairs well with accessories → Add both → cart has both → cart rail → home shows Still in your cart + Because you viewed; 2 orders → Frequently bought together; mobile | `e2e/discovery.spec.ts` |

## 4. Results

| Run date | Command | Result | Notes |
|---|---|---|---|
