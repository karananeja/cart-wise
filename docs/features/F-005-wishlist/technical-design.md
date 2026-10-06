# Technical Design — F-005 Wishlist

**Status:** Implementation
**Inputs:** specification.md (approved), F-004 design (anonymous cookie pattern)

## 1. Data

```sql
wishlists(id TEXT PK, created_at, updated_at)
wishlist_items(wishlist_id FK → wishlists ON DELETE CASCADE, product_id FK → products ON DELETE CASCADE, added_at,
               PRIMARY KEY (wishlist_id, product_id))
```

New tables only, so no schema-version change. Expiry: wishlists untouched for 90 days are deleted at start and hourly, alongside carts.

## 2. API

- **Shared cookie helpers** (`http/cookies.ts`): reading and setting HTTP-only, `SameSite=Lax` cookies. Used by the cart and the wishlist.
- **Service** (`wishlist/service.ts`):
  - `view(id)` returns items newest first, with fresh product summaries;
  - `save(id, slug)` is idempotent, creates the wishlist on first save, and refuses at 100 (`WISHLIST_FULL`);
  - `remove(id, slug)` is idempotent.
- **Routes:**
  - `GET /api/wishlist`
  - `PUT /api/wishlist/items/:slug`
  - `DELETE /api/wishlist/items/:slug`

  Each returns the full `WishlistView`.

## 3. Web

- **Data hooks** (`features/wishlist/api.ts`):
  - `useWishlist` (key `['wishlist']`);
  - `useSavedIds` (a `Set` derived from it);
  - `useToggleWishlist({ product, save, source })` — optimistic insert or remove of the product summary; scoped mutations (`scope: 'wishlist'`); rollback on error; analytics on success.
- **WishlistToggle:**
  - `variant="card"`: a round button over the image corner, layered above the card's stretched link;
  - `variant="inline"`: an outline button labelled Save / Saved on the product page.
  - Both use `aria-pressed` and a product-specific label.
- **Header:** HeaderWishlistLink, mirroring HeaderCartLink.
- **WishlistPage:**
  - **Move to cart** fetches product detail through the shared product query (a cache hit if visited), because summaries don't carry sizes.
  - **Unsized:** add to cart, then remove from the wishlist with source `moved_to_cart`.
  - **Sized:** open `SizePickerDialog` (shadcn Dialog; bottom-anchored on small screens), reusing `SizeSelector`.
- **Cart page:** each line gets **Move to wishlist** (save, then remove the line). It reuses the Undo toast, which restores the cart line.
