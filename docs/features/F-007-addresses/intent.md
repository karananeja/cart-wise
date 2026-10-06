# Feature Intent

**Feature:** F-007 — Address management (map-assisted)
**Status:** Approved
**Approved by / date:** User, 2026-10-06

---

## 1. In one sentence

Signed-in customers save delivery addresses by finding the spot on a map (search, tap or "use my location"), checking the details that fill in, and adding their flat number. They can keep up to 10, with one default.

## 2. Intended behavior

- **Where:** My account → **Addresses**, listing saved addresses as cards, with the **Default** one first.
- **Add address, with the map:**
  - **Step 1:** a map with a search box ("Indiranagar Bengaluru") and **Use my current location**. Tap the map or drag the pin to fine-tune. Below it: "Near: Indiranagar, Bengaluru 560038". Press **Confirm location**.
  - **Step 2:** a form pre-filled with pincode, area, city and state. Add the flat/house details, optionally a landmark, choose Home, Work or Other, and save.
- **No map needed:** **Enter address manually instead** is always there. If the map can't load, the form takes over automatically.
- **Edit, Delete (with Undo), Set as default:** the first address is the default automatically. Deleting the default makes the newest remaining one the default, and says so.
- **Privacy:** location is asked for only when you tap the button. Searches go through our server, so the map service never sees your browser.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| Map first, form second, manual always available | Brief §11 flow; least typing; never a dead end |
| Everything pre-filled stays editable | Map lookups are approximate, especially for Indian addresses |
| Undo instead of "Are you sure?" | Consistent with the cart; fewer dialogs |
| Default always exists and is visible | Checkout can pre-select without asking |
| OpenStreetMap through our server | Your Q7 decision; free, no keys; respects their usage policy |

## 4. What this feature deliberately does not do

Delivery charges or pincode serviceability (F-008), guest addresses, Google Maps, address verification, autocomplete on the manual form.

## 5. How we will know it works

Acceptance criteria 1–14 in `specification.md` §17.

## 6. Decisions needed before implementation

Resolved 2026-10-06: 10 addresses; deleting the default promotes the newest remaining; signed-in only.

## 7. Approval

- [x] Approved for implementation (Gate 1) — 2026-10-06
