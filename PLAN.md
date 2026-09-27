# OSIP mobile-first PWA plan

Status: proposal, with an independent Astra scope review; implementation has not started.

## Product direction

Build a daily farm workspace that connects planning, information, learning, and services. The opening screen answers: what needs attention today, what is the weather at my farm, and what have I booked?

[CONFIRMED] The current project is an HTML/CSS/JavaScript landing-page prototype with a local checklist and service worker. Its README documents no backend, account system, shared booking records, or live weather integration.

Recommended first milestone: an interactive prototype covering all eight requested features, followed by a staged production rollout. Prototype listings, forecasts, chats, and transactions will be explicitly labeled demonstrations. Local schedules and calculators can actually work during this milestone.

The country, languages, main crop types, first-delivery scope remain open. The plan does not assume a country from the development computer's timezone.

## Role-based onboarding

- Start with “I'm a farmer” or “I'm a drone pilot”; allow both roles and later role switching.
- Farmer setup: farm location, preferred units, and main crops, followed by an optional first plot and task.
- Pilot setup: service area, supported work, equipment, availability, and relevant credentials.
- Show pilot verification as pending, approved, or needing changes; accepting bookings requires approval under criteria to be defined for the target region.
- Save onboarding progress, collect only what is needed at each step, and let users complete optional details later.
- Route farmers to their farm workspace and pilots to service requests and availability; switching roles preserves their separate records.

## Mobile organization

Use five persistent bottom destinations. Place profile, notifications, and the booking inbox in the header; also expose each conversation on its booking detail screen.

| Destination | Content |
| --- | --- |
| Home | Selected farm, local weather and wind, today's tasks, next booking, latest information, common shortcuts |
| My Farm | Farms and plots, crop records, schedule, recurring tasks, activity history |
| Learn | Veteran Encyclopedia, saved articles, course discovery and enrollments |
| Services | Drone pilots, booking history, agricultural drone shop |
| Tools | Farmer calculators and saved calculations |

Example Home order: farm selector → compact forecast → today's schedule → next booking → shortcuts → latest updates. A new user sees an Add your farm action instead of fabricated farm metrics.

## Eight features and their flows

### 1. Digital farm, schedule, and alerts

- Add a farm with a name, location, timezone, and preferred area units; location can be entered manually.
- Add plots with crop, area, planting date, and notes; start with field cards and a simple overview, with geographic boundary drawing as a later enhancement if needed.
- Open a plot → create a task → choose date/time, repeat rule, and reminder → save → mark complete or reschedule.
- Use an agenda as the default mobile schedule, with a calendar as an alternative.
- Distinguish due, overdue, completed, and locally saved tasks; explicitly show whether reminder delivery is enabled.
- For production, schedule notifications on the server, cancel obsolete reminders after edits, and prevent duplicates when requests are retried.

### 2. Veteran Encyclopedia

- “Veteran Encyclopedia” is a working title supplied in the brief, not a defined product category; provisionally interpret it as an agricultural knowledge library with practical knowledge from experienced farmers.
- Recommend the clearer navigation label “Farming Knowledge”; confirm whether experienced-farmer contributions are intended before changing the feature name.
- Search by crop, topic, and locally relevant terms; cover cultivation, equipment, irrigation, and problem identification.
- Article → practical steps and photographs → source, author/reviewer, applicable region, review date → save for offline reading.
- Use reviewed source material. Clearly distinguish experience-based contributions from formally reviewed guidance; do not invent expert credentials or recommendations.
- Provide an editorial workflow for drafts, review, publication, and corrections before accepting live submissions.

### 3. Local forecast and wind

- Forecast uses the selected farm location, with optional current-location permission and a manual fallback.
- Show hourly and daily views with rainfall, temperature, wind speed, gusts, and direction.
- State direction as the source direction, such as “wind from NE,” alongside a clearly labeled compass.
- Display forecast source, location, update time, and stale/offline status.
- Make the same forecast reachable while choosing a drone booking date. Forecast information does not automatically certify safe spraying or flight conditions.

### 4. Drone pilot booking and messages

- Filter pilots by service area and supported work → view profile and indicative pricing → select farm/plot, area, requested date, and job details → send request.
- Start with request-based booking: requested → accepted or declined → scheduled → completed, with cancellation and rescheduling paths.
- Attach messages and schedule proposals to the booking; accepting a proposed time changes the booking record explicitly rather than relying on chat text.
- Build a minimal pilot/operator view to accept requests, respond, maintain availability, and mark work complete.
- Production confirmation must check availability on the server and avoid duplicate or conflicting reservations.

### 5. Course booking

- Browse by technique, crop, location, and online/in-person format → view instructor, prerequisites, date, price, and seats → enroll → receive booking detail and reminder.
- Include full, cancelled, and changed-date states, along with My courses.
- Production enrollment reserves capacity on the server; all Learn by doing courses are free and require no payment.

### 6. Other services, shop, and QR payment

- Drone shop: category → product detail with actual specifications and availability → cart or quote request → order summary → payment → order status.
- QR payment: create an order with amount and reference → display provider-generated QR and expiry → show pending → confirm through a verified payment-provider event → issue receipt.
- Include a same-device payment option supported by the eventual provider, because a person shopping on a phone cannot assume access to a second screen for scanning.
- Handle failed, expired, cancelled, and refunded payments. A scanned QR, browser redirect, or uploaded screenshot alone never marks an order paid.
- Payment country, currency, provider, fulfillment, and cancellation policy must be decided before live checkout.

### 7. Latest information

- Feed for relevant agricultural news, announcements, opportunities, and events; filter by region and topic.
- Show publisher, publication date, source link, and expiry for time-sensitive announcements.
- Start with a curated feed managed through the same editorial system as the encyclopedia; provide bookmarks and optional notification preferences.

### 8. Farmer calculator

- Start with area/unit conversion, plot input-cost totals, and gross-margin estimates using values entered by the farmer.
- Each calculation shows units, inputs, formula, rounding, assumptions, and result; allow saving to a farm or plot.
- These functions work offline and receive focused tests for unit conversion, invalid values, decimal precision, and boundary cases.
- Add seed or application-quantity calculators only after crop requirements and validated formulas are agreed; do not infer pesticide rates or guaranteed yields.

## Visual and interaction approach

Reading this as a mobile farm operations product for farmers, with a practical, welcoming visual language and strong outdoor readability.

- Keep the requested HTML, Tailwind, JavaScript, and GSAP stack.
- Carry OSIP's green identity into a compact interface with readable sans-serif text, clear status labels, labeled icons, and a consistent spacing system.
- Design at narrow phone widths first, with large touch targets, bottom navigation, short forms, and primary actions reachable without excessive scrolling.
- Use licensed agricultural stock photos for articles, courses, service profiles, and products where appropriate; keep essential information as text.
- Use the taste skill for editorial and discovery surfaces. Its own instructions exclude operational dashboards and multi-step forms, so its marketing effects will not dictate scheduling or payment flows.
- Use GSAP for brief sheet transitions and meaningful state feedback; respect reduced motion and keep repeated task interactions immediate.
- Use the mobile references for imagery and content hierarchy, while ensuring the farm workflow remains usable with animation disabled.

## Technical implementation

Frontend: semantic HTML, compiled local Tailwind CSS, small JavaScript modules per feature, shared navigation/forms/status components, and explicit interfaces for data access. Replace the prototype CDN compiler before production. Dependencies remain subject to the project's installation approval rule.

Local data: use IndexedDB for structured farm records, drafts, saved articles, and queued changes; use localStorage only for lightweight preferences. Keep the existing checklist intact until a defined migration or replacement decision is made.

Backend for live operation: authentication, ownership/role checks, persistent database, file storage, editorial administration, provider operations, messaging, scheduled reminders, and external service integrations. Provider selection follows region, cost, and operational requirements.

Core records: users, farms, plots, crop cycles, tasks/reminders, articles, providers, availability, bookings, conversations/messages, courses/enrollments, products/orders/payment events, and saved calculations.

Use the same booking detail and status patterns across services while preserving the distinct rules for pilot acceptance, course capacity, product stock, and payment.

## Offline and reliability contract

| Situation | Expected behavior |
| --- | --- |
| No connection | Open installed shell, view downloaded content, use calculators, edit farm notes and tasks locally |
| Unsynced farm edits | Show “Saved on this device” and a pending-sync indicator; detect conflicting server revisions |
| Offline booking/message | Save a draft, clearly marked unsent; require an explicit send after reconnect and availability revalidation |
| Offline checkout | Preserve cart; payment and final confirmation require a connection |
| Cached weather/news | Show timestamp and stale status; never imply cached content is current |
| Repeated submit/retry | Server deduplicates requests and payment events |
| Account change/sign-out | Clear or isolate account-specific local data; keep public shell assets separate |
| App update | Offer an update without interrupting a draft, active booking, or checkout |

[DOCUMENTED] Web Push receives server messages through a service worker, including when the page is not open. Permission and platform support apply. WebKit documents iOS/iPadOS support for installed Home Screen apps starting with 16.4. The proposed reminder system uses server scheduling and an in-app alert history; it does not promise exact alarm delivery or offline background timers. An additional reminder channel can be selected if essential.

## Delivery sequence and review gates

1. **Screen plan and design direction:** farmer/pilot onboarding and role switching, mobile navigation, Home and My Farm wireframes, booking flow, typography/colors, and representative loading/empty/error states. Review the daily workflow before expanding its visual system.
2. **Complete interactive prototype:** all eight modules, persistent local farm tasks, working calculators, and clearly labeled simulated weather, bookings, messaging, and checkout. Gate: demonstrate task creation, article saving, pilot request/chat, course enrollment, shop checkout, and a saved calculation on a phone-sized interface.
3. **Connected farm foundation:** accounts, farm synchronization, chosen live weather source, editorial content, and server-driven reminders. Gate: user isolation, stale-data handling, reminder changes, and reconnect behavior verified.
4. **Service operations:** pilot/provider tools, request acceptance, booking-specific conversations, courses and capacity. Gate: a booking works from both farmer and provider sides, including conflicts and rescheduling.
5. **Commerce and release:** real inventory/order handling, chosen QR provider, payment verification, cancellation/refund handling, and release checks. Gate: paid/failed/expired flows, duplicate callbacks, and recovery are verified in the provider's test environment before live payments.

Verification includes targeted unit/integration tests, mobile keyboard and screen-reader behavior, Android/iOS PWA installation, weak-network/offline recovery, reduced-motion behavior, and meaningful browser journeys. Full-suite/E2E execution and infrastructure work require the existing project approvals. Dates and costs will be estimated after scope, providers, and content availability are confirmed.

## Decisions needed

1. First delivery: interactive demonstration of every feature, or a live product with real users and service providers?
2. Target country/regions, languages, and initial crop/farmer groups?
3. Who authors/reviews Veteran Encyclopedia content?
4. Who operates pilot bookings, course listings, product stock, and customer support? Request-based pilot bookings are the proposed starting point.

## Evidence

- Existing capabilities: project README.md and AGENTS.md, inspected for this plan.
- Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- iOS/iPadOS Web Push requirements: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Payment confirmation pattern: https://docs.stripe.com/payments/payment-intents/verifying-status (implementation reference, not a provider selection).
- Mobile references: https://www.awwwards.com/inspiration/mobile-layout-deluxbury-sea-farm and https://www.awwwards.com/inspiration/food-facts-mobile-agency-eats

## Review Notes

- This document proposes the product structure, feature flows, implementation order, and verification criteria; application behavior was not changed.
- Backend, payment, weather, and notification vendors remain unselected until geography and live-delivery scope are known.
- Human review is needed for service definitions, content ownership, calculator formulas, and transaction policies before production implementation.

## Implementation checkpoint — 26 September 2026

The interactive prototype milestone is implemented in HTML, Tailwind CSS, and vanilla JavaScript. It uses local state and clearly marked sample external services, with role-aware home, farm/plot scheduling, saved guides, requests and local conversations, courses, checkout simulation, and tested calculators. Live-provider decisions above remain open; no backend or payment integration is implied.

The visual implementation is Revolut-inspired because the current public UI package is a shim over a private internal package. Mobile copy was reduced, decorative uppercase labels removed, and dot badges removed following the latest design feedback.
