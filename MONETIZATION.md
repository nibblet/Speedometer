# Monetization

## Decision

**CARTpath ships as a one-time paid app at $4.99. No subscription. No ads.**

- Set the price in **App Store Connect** (Apps → CARTpath → Pricing and Availability →
  Price Schedule → **Tier 5 / USD $4.99**). This is a store setting, **not** a code or
  `eas.json` change — nothing in the build needs to know the price.
- "Pay once, no subscription, no ads" is a deliberate marketing point that sets us apart
  from the generic GPS-speedometer clones.

## Why $4.99 one-time

CARTpath is a **special-use app** (golf-cart joyride + Course satellite mode + neighborhood
places), not a generic speedometer. The market splits cleanly:

- **Generic "GPS speedometer" apps** → free + aggressive subscriptions
  (e.g. $4.99/**week**, ~$17.99/yr, trials that auto-convert). A commodity race to the bottom.
- **Niche / special-use apps** (marine, cycling, motorcycle, Apple Watch) → almost all
  **one-time purchase** or free + a single one-time unlock. This is our lane.

Observed one-time price points (mid-2026):

| App | Price | Niche |
| --- | --- | --- |
| Watch Speedometer Pro | $1.99 | Apple Watch |
| Speed Tracker Pro | $2.99 | Driving |
| Cycling offline-maps unlock | $3.99 | Cycling |
| Motorcycle "pro" unlocks | ~$3.99 | Motorcycle |
| Speedometer 5G | $5.99 | Driving / HUD |
| GPS Speedometer (paid) | ~$7.00 | General |
| Speedometer Simple | $10.00 | Minimalist |

Average ≈ $5, median/mode ≈ $3.99. Sweet spot for paid utilities is **$2.99–$4.99**.
We sit at the top of the impulse-buy band ($4.99): a niche audience means we compete on
fit, not volume, so there's no need to undercut to $0.99–$1.99 (which also reads as
low-quality and barely clears Apple's per-sale overhead).

## Alternative considered: free + one-time unlock

Free download + a single **$4.99 non-consumable IAP** ("CARTpath Pro" — e.g. unlocks Course
mode + custom accent colors). Still no subscription.

- **Pros:** more installs and reviews (helps ranking), try-before-buy.
- **Cons:** adds StoreKit work — one non-consumable product, purchase + **restore purchases**
  flow, and receipt handling. Not currently built.

**Not chosen for launch.** Start with the flat $4.99 paid app (zero IAP code). If discovery
is slow, we can move to free + unlock later. Going the other direction (paid → free) annoys
early buyers, so flat-paid-first is the safer order.

## Explicitly rejected

- **Subscriptions** — wrong model for a focused one-purpose utility; user-hostile in this
  category.
- **Ads** — degrades a glanceable in-vehicle UI; not worth the revenue at this scale.

## Out of scope (tracked elsewhere for submission)

These are required to submit but are not monetization and not code:

- Hosted **privacy policy** URL.
- App Store **privacy labels** (the app collects precise location).
- Listing copy: description, keywords, screenshots.
