# Aura farm companion

Mobile-first HTML, Tailwind CSS, and vanilla JavaScript PWA. This is the interactive prototype milestone in `PLAN.md`, with a Revolut-inspired visual system adapted for farming. It does not use Revolut's private UI kit.

## Run

```sh
npm install
npm run build
npm run dev
```

Open http://127.0.0.1:4173. The server serves only an explicit public-file allowlist and provides application-route fallback. The build bundles Tailwind CSS, GSAP, and a Tabler SVG sprite locally; there are no runtime CDN dependencies. Rebuild after changing source styles or modules, then use the app's update prompt to activate the new cached shell.

## Available now

- Farmer, drone-pilot, and dual-role profile setup; recovered onboarding drafts and role switching.
- Farm and plot records, dated tasks, completion tracking, and in-app due reminders.
- Farming guide search, topic filters, and offline saved guides.
- Plant photo analysis and problem search, accessible from Learn; both lead to the same ten plant-problem guides.
- Sample wind/weather, pilot comparison, booking requests, proposed schedule changes, and booking-linked local messages.
- Course requests, shop cart, unpaid orders, and a clearly marked payment simulation inside checkout.
- Area conversion, planned material costs, gross-margin calculation, and saved results.
- Installable app shell, cached deep routes and bundled photographs, reduced-motion support, accessible forms and touch targets.

Records persist on this browser/device using localStorage. Existing checklist records migrate into the farm task list. Writes are validated and committed only after storage succeeds. The application does not collect passwords, credentials, or payment details.

## Plant photos and problem search

The larger centre button in the flat mobile navbar opens Camera or Search. Hold for about half a second to switch modes, then tap to open the selected tool. With a keyboard, focus the button and use either arrow key or Shift+F10 to switch; Enter or Space opens it. Both tools lead to the same guides. Learning remains available from the home screen and desktop navigation.

The blank `.env` file is ready for your key:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Run `npm run dev` again after editing `.env`. Node loads this file on startup; it is ignored by Git, excluded from the public file allowlist and never included in the service worker cache. `.env.example` is the shareable template. The server calls the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/images-vision) with image input and [structured output](https://developers.openai.com/api/docs/guides/structured-outputs). No additional package is required.

Capture a photo using the phone's rear-camera picker, or choose an existing image. Supported browsers can decode JPEG, PNG, WebP and some phone formats; unsupported formats show a retry message. The app resizes the image to a maximum 1600-pixel edge and re-encodes it as JPEG before upload. Selecting a photo does not send it: only **Analyze photo** sends it to OpenAI. Photo previews and results stay in memory and are cleared when leaving the camera page; this app does not store them. The provider request sets `store: false`; this is not a promise about all provider retention.

## Languages

Use the header language selector or Account → Preferences for English, Bahasa Melayu, or Simplified Chinese. The preference is saved on this device and all translation files are cached for offline use. Switching languages preserves unfinished form fields; names, notes, messages and other entered records retain their original text. New photo analyses request the selected language; existing summaries are not automatically regenerated. Plant problem search accepts English, Malay and Chinese terms. Translations should receive native-speaker editorial review before production.

Results distinguish visible observations from possible issues and link to up to three existing guides. Non-plant or inconclusive images do not receive a made-up diagnosis. Search covers pests, symptoms, crops and common local names; the same guides remain available offline after the PWA caches them. Articles include primary agricultural sources and require regional agronomic review before production.

Photo analysis needs connectivity and a valid key. By default the paid endpoint accepts only same-origin localhost requests, with upload caps, timeouts, rate and concurrency limits. It is a development endpoint; production needs authentication, user-level quotas and HTTPS. Live provider output and physical phone camera behaviour have not yet been verified.

For trusted private-LAN phone testing, optionally add `PLANT_ANALYSIS_ORIGIN=http://192.168.1.10:4173` to `.env`, replacing the address with this computer's private IPv4 address, then restart `npm run dev`. Use that exact origin on the phone. This explicitly enables development analysis for private-network clients; do not enable it on an untrusted network. Wildcards, public addresses and forwarded headers are rejected. Plain HTTP LAN access does not support all installable-PWA capabilities; use an authenticated HTTPS deployment for production.

## Scope and limitations

Weather, provider availability, news, course seats, shop inventory, and prices are sample data. Booking requests and chat messages stay on the device; they are not sent. Pilot credential references remain pending and never self-approve. Payment simulation moves no money and generates no payable QR. Health-service scope remains undefined. Content requires agricultural review before production.

Background push, real authentication, cloud synchronization, live service operations, and payment verification require separate providers and backend work. Reminders only appear while this app is open. Deploy at the origin root over HTTPS; localhost works for local PWA development. Physical iOS/Android installation has not been verified.

## Routes

| Area | Routes |
| --- | --- |
| Home | `/` (role-aware), `/onboarding/role`, `/onboarding/farmer`, `/onboarding/pilot`, `/onboarding/pilot/verification` |
| Farm | `/farm`, `/farm/:id`, `/farm/:id/plots/:plotId`, `/farm/:id/schedule`, `/farm/:id/tasks/:taskId`, `/weather/:farmId` |
| Learning | `/learn`, `/learn/knowledge`, `/learn/knowledge/:slug`, `/learn/saved`, `/learn/courses`, `/learn/courses/:id`, `/learn/courses/:id/book`, `/learn/my-courses` |
| Plant help | `/plant-help` (search), `/plant-help/camera`, `/plant-help/guides/:slug`; `POST /api/plant-analysis` (server only) |
| Services | `/services`, `/services/pilots`, `/services/pilots/:id`, `/services/pilots/:id/book` |
| Bookings | `/bookings`, `/bookings/:id`, `/bookings/:id/chat`, `/messages` |
| Pilot | `/pilot`, `/pilot/requests`, `/pilot/availability`, `/pilot/profile` |
| Shop | `/shop`, `/shop/products/:id`, `/shop/cart`, `/checkout/cart`, `/checkout/:id`, `/checkout/:id/payment`, `/orders`, `/orders/:id` |
| Tools | `/tools`, `/tools/area`, `/tools/cost`, `/tools/margin`, `/tools/saved` |
| Account | `/account`, `/account/settings`, `/notifications`, `/auth/sign-in`, `/auth/sign-up` (local profile only) |
| News | `/news`, `/news/:slug` |

## Verification

Scoped test files cover calculators, state validation/migration, form actions, renderer contracts, static server boundaries, and service worker behavior. Run individual files with `node --test tests/<file>`. `npm run test:core` groups those checks. It is not a browser E2E suite.

Plant-help checks: `npm run test:plant`. Provider responses are mocked; these tests never use a real API key or send a paid request.

## Design and assets

Revolut's official design principles: https://www.revolut.com/blog/post/our-top-5-design-principles-at-revolut/

The mobile spacing and grouped surfaces also reference [Revolut's official app examples](https://www.revolut.com/blog/post/revolut-10/). Glass is a CSS approximation with opaque and reduced-transparency fallbacks.

The public `@revolut/ui-kit` 15.0.0 is a shim with a private `@revolut-internal/ui-kit` peer dependency. This project uses its own HTML components and styling.

Stock photographs are bundled under the [Unsplash license](https://unsplash.com/license); their role is illustrative, not a photo of a listed farm or product:

| Asset | Photographer | Source |
| --- | --- | --- |
| `assets/farm.jpg` | Ivan Bandura | https://unsplash.com/photos/o7GsKbYBpPY |
| `assets/crops.jpg` | Silas Baisch | https://unsplash.com/photos/PvBECXDZw84 |
| `assets/course.jpg` | Henrique | https://unsplash.com/photos/tfiHtraYTgI |
| `assets/drone.jpg` | Dose Media | https://unsplash.com/photos/ramqoN2kiuo |
| `assets/learn-soil.jpg`, `assets/learn-soil-thumb.jpg` | Sandie Clarke | https://unsplash.com/photos/q13Zq1Jufks |
| `assets/learn-water.jpg`, `assets/learn-water-thumb.jpg` | Bernd Dittrich | https://unsplash.com/photos/sktVzTJcGAs |
| `assets/learn-scouting.jpg`, `assets/learn-scouting-thumb.jpg` | An Shved | https://unsplash.com/photos/7Xmz_eyC-9A |
| `assets/learn-harvest.jpg`, `assets/learn-harvest-thumb.jpg` | Zoe Richardson | https://unsplash.com/photos/hmoDcZnB7uw |

Icons: Tabler Icons, MIT license. Animation: GSAP, standard no-charge license. Tailwind CSS: MIT license. Source dependency licenses remain in their installed packages.

The account portrait (`assets/profile-ahmad.jpg`) is an illustrative stock photo by Pixabay on [Pexels](https://www.pexels.com/photo/man-smiling-behind-wall-220453/), used under the [Pexels license](https://www.pexels.com/license/). It is bundled locally for offline access.

Plant-help searches first match the offline guides. Submitting a query with no matches calls `/api/plant-search` using the same server-side `OPENAI_API_KEY` and model configuration as photo analysis. Users can also retry with **Search the web with AI**. Web research is restricted to plant and crop problems and displays clickable citations and a vertical source list. Online search requires internet; typing alone never sends a web request.

## Spray estimates

Tools → Spray estimate uses the saved land or individual field area for one application. Reference setups cite DJI T40 paddy (15 L/ha, 40 L tank), DJI T30 (4.8 L/acre, 30 L tank), and Penn State's calibrated backpack example (20 US gal/acre; a separately identified editable 16 L tank assumption). These are documented examples, not evidence of regional adoption or pesticide dose recommendations. Select a setup, review its calibrated spray volume and tank size, and optionally enter the formulated product label rate in mL/ha, g/ha, mL/L or g/L of finished spray. Results distinguish finished mixture from product, tank loads and the partial final load. No overlap allowance, spot-treatment fraction, active-ingredient calculation or label compliance assessment is inferred.

The optional `/api/spray-config` uses the existing server-side OpenAI configuration to extract explicitly supplied quantities from natural language into a reviewable draft. Missing or ambiguous values remain blank; farmers must check AI interpretations against their labels before calculating. Manual estimation works offline; AI requires internet. No product recommendations or inferred doses are requested, and no configuration is automatically saved.
