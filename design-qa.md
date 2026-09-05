# Design QA — Meeting location data chain

## Scope

- Admin source: project settings → meeting location directory.
- Operational source: rooming management → final hotel assignment.
- Public output: attendee lookup → hotel, meeting venue, room type and stay dates.
- Reference: `/var/folders/qx/glgdffcs1cl2hszg7mnpcxp80000gn/T/codex-clipboard-a7f3fc2f-26d1-4200-8f77-bb847ab08ef2.png`.
- Current captures: `.tmp/browser/location-catalog-settings.png`, `.tmp/browser/rooming-hotel-column.png`, `.tmp/browser/portal-query-balanced.png`.
- Workflow captures: `.tmp/browser/ticket-cta-settings.png`, `.tmp/browser/ticket-cta-roster.png`, `.tmp/browser/privacy-paper-upload-port.png`.
- Combined comparison: `.tmp/browser/reference-vs-location-query.png`.

## Data and interaction fidelity

- A single meeting-scoped catalog now owns stable IDs for cities, hotels and meeting venues.
- Hotel and venue rows are linked to a city; venues may optionally link to a hotel.
- When a city has several venues, exactly one default venue is required. A single venue becomes the default automatically.
- Registration stores the selected city ID. Rooming stores the selected hotel ID. Public lookup resolves both IDs against the same catalog.
- Database triggers reject invalid city/hotel/venue references and prevent deleting catalog items that are still in use.
- The end-to-end browser smoke test successfully followed city → hotel → rooming → public lookup and displayed the same hotel and venue names.

## Visual fidelity

- The project settings editor remains compact and uses the existing card, border, radius and typography tokens.
- City, hotel and venue controls remain aligned without text overlap; dependent hotel options refresh when the city changes.
- Rooming adds one hotel column without changing the existing stay-date, room-type or status hierarchy.
- Public lookup presents five balanced fields in one summary: hotel, venue, room type, check-in and check-out.
- Desktop and 390 × 844 mobile checks report no horizontal page overflow.
- The signature and ticket workflow uses the same compact project-settings card language. Ticket labels and approval prerequisites remain aligned in three columns, and collapse to two fields plus a full-width action on small screens.
- CTA controls are visibly disabled for ordinary meetings and appear in the roster only when a researcher meeting explicitly enables the feature.
- Selecting the paper privacy-letter status expands a compact required-upload panel in the same roster cell; the stored status remains unchanged until a valid file finishes uploading.
- Participant pickup-sign thumbnails now use an absolute private-storage URL. Before returning it, the query service confirms the exact current storage object and returns its MIME type and byte size; image and PDF uploads both render as previews of the current file. Broken image loads are replaced in place with a readable re-upload notice instead of navigating to a raw 404 page.

## Verification

- `location-catalog-chain-smoke.mjs`: city-to-hotel, city-to-venue, rooming persistence and lookup all passed.
- `meeting-venue-source-smoke.mjs`: registration and roster use authoritative meeting cities.
- `portal-query-layout-smoke.mjs`: desktop and mobile layout, hotel and venue rendering passed.
- `query-rooming-sync-smoke.mjs`: Edge query uses final rooming and venue records.
- JavaScript syntax, static build and diff whitespace checks passed.
- `ticket-cta-privacy-smoke.mjs`: editable ticket dictionary, researcher-only CTA column, visible paper privacy-letter upload port, pre-upload non-closure and post-upload completion state passed.
- Production storage check: the existing pickup-sign object is present, and a freshly signed public-query URL returns HTTP 200 with `image/jpeg`.

## Findings

- No actionable P0, P1 or P2 visual issue remains in the tested states.
- A live attendee correctly shows `待安排` / `待公布` until an administrator configures and assigns the relevant hotel or meeting venue; no placeholder is persisted as real business data.

final result: passed
