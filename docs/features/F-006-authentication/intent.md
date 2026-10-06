# Feature Intent

**Feature:** F-006 — Sign-up, sign-in and guest state merge
**Status:** Awaiting Approval
**Approved by / date:** —

---

## 1. In one sentence

Shoppers sign up with name, email, mobile and password, confirm their mobile with a code, and afterwards sign in with just their mobile and a code. Everything they collected as a guest comes with them, and they land back where they were.

## 2. Intended behavior

- **Sign up:**
  - four fields (no address);
  - a code is "sent" to the mobile and shown in a clearly marked demo banner;
  - entering it creates the account and signs you in.
- **Sign in:**
  - enter your mobile → enter the code → done;
  - prefer passwords? "Use password instead" accepts email or mobile plus password;
  - forgot it? Reset with a code.
- **Header:** guests see Sign in. Signed-in shoppers see "Hi, Karan" with My account and Sign out.
- **Nothing lost:** your guest cart, wishlist, recently viewed and recent searches merge into your account.
  - If the same item is in both carts, the **larger quantity** wins.
  - A short note confirms it: "Welcome back — we kept your cart."
- **Back where you were:** signing in from a product page (even with a size chosen) brings you back to it.
- **Signing out** leaves this browser as a fresh guest. Your account keeps everything for next time, on any device.
- **Never forced yet:** checkout (F-008) will be the first place that requires signing in.

## 3. Key UX choices

| Choice | Reason |
|---|---|
| OTP is the default sign-in; password is one link away | Your decision; fastest for mobile-first shoppers |
| Codes shown in a demo banner | Delivery is simulated; makes the flow testable without SMS |
| Larger quantity wins on merge | Your decision; avoids accidentally doubling an order |
| Unknown number → "Sign up?" with the number kept | No dead end; a clear answer is better for a shop |
| Sign-out returns to a fresh guest | Privacy on shared devices; nothing is lost from the account |
| No address at sign-up | Brief §4: keep sign-up light |

## 4. What this feature deliberately does not do

Social login, real SMS or email, email verification, profile editing, account deletion, 2FA, session lists, CAPTCHA, addresses (F-007), orders (F-010).

## 5. How we will know it works

Acceptance criteria 1–14 in `specification.md` §17.

## 6. Decisions needed before implementation

1. Confirm the sign-in reading: OTP by default, with password sign-in as an alternative.
2. Confirm the code rules: 6 digits, 5 minutes, 5 attempts, resend after 30 seconds, 5 per hour.
3. Confirm the sign-out behaviour: the device becomes an empty guest; the account keeps its items.

## 7. Approval

- [ ] Approved for implementation (Gate 1)
