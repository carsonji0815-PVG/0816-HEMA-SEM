# Design QA — Public attendee portal mobile direction 1

## Comparison target

- Primary source visual truth: `/Users/carson/.codex/generated_images/01a012e2-0819-7700-aaee-8595dc86f3d9/exec-801a1b3f-b459-4c9e-bd5a-8d663b318442.png`
- Journey hierarchy source: `/Users/carson/.codex/generated_images/01a012e2-0819-7700-aaee-8595dc86f3d9/exec-3938cbd4-786b-4711-a2ac-bb8a0eb7567d.png`
- Mobile entry implementation: `.tmp/browser/mobile-portal-lookup-compact.png`
- Mobile result implementation: `.tmp/browser/mobile-portal-query-result.png`
- Mobile journey focus: `.tmp/browser/mobile-query-journey-focus.png`
- Desktop result implementation: `.tmp/browser/portal-query-balanced.png`
- Full-view comparison: `.tmp/browser/mobile-option1-comparison.png`
- Focused journey comparison: `.tmp/browser/mobile-journey-comparison.png`
- State: participant portal, `参会信息查询` active; both empty/query-entry and successful query-result states.

## Viewport and normalization

- Mobile CSS viewport: `390 × 844`; device scale factor `2`.
- Mobile viewport captures: `780 px` wide. The generated source was normalized from `853 × 1844` to `780 × 1688` for the full-view comparison.
- Mobile result full-page capture: `780 × 5432`.
- Mobile journey element capture: `700 × 1744`.
- Desktop CSS viewport: `1440 × 1100`; device scale factor `1`.

## Full-view comparison evidence

- The implementation preserves direction 1's hierarchy: compact Lilly header, project identity, two-by-two meeting facts, a single horizontal service strip, one-row service navigation, query purpose, phone input, and one primary action.
- Compared with the source, the implementation is intentionally denser above the fold so the phone input and query button remain visible on a 390 × 844 screen.
- No horizontal overflow, clipping, overlapping text, or hidden primary control was observed.

## Focused journey comparison evidence

- Each outbound and return journey follows the selected direction 3 hierarchy exactly:
  1. `航班号 / 车次号` occupies one full-width row.
  2. `出发时间` and `出发航站楼 / 高铁站` share the next row.
  3. `抵达时间` and `抵达航站楼 / 高铁站` share the final row.
- Long terminal and high-speed-rail station values wrap inside the station column without affecting the time column.
- Meeting-city and local-origin transport sections reuse the same journey component on mobile and desktop.

## Required fidelity surfaces

- Fonts and typography: existing Chinese system font stack retained; mobile journey labels are `9px` and values `11px`, with larger section headings and adequate wrapping. The hierarchy remains readable at the target viewport.
- Spacing and layout rhythm: compact 6–10px mobile page rhythm, consolidated fact grid, slim service row, and consistent 8–10px journey row padding match the selected density.
- Colors and visual tokens: Lilly red remains the primary brand/action color; warm ivory surfaces and restrained teal query accents match the established product palette.
- Image quality and asset fidelity: supplied Lilly logo and existing service-desk raster icon are retained; no placeholder image replaces a source asset. Placard previews remain real thumbnails.
- Copy and content: meeting facts, service contacts, portal purposes, journey numbers, departure/arrival times, and full station names remain intact.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- P3: The live project may show `待公布` for venue, deadline, or service contacts until those fields are configured in the admin project settings. This is data state, not layout drift.

## Primary interactions tested

- Switched among `我要报名`, `更改已报名`, and `参会信息查询`.
- Submitted a mocked 11-digit phone number and rendered a successful query result.
- Verified outbound and return journeys in both meeting-city and local-origin sections.
- Verified the pickup placard thumbnail remains visible.
- Checked browser page errors and horizontal overflow at mobile and desktop widths.

## Comparison history

1. Initial implementation used five equal journey columns, causing the number, departure, and arrival information to read as disconnected fields.
2. Replaced it with a three-row journey component shared across mobile and desktop.
3. Increased label/value sizes after focused comparison and re-captured both viewports.
4. Post-fix smoke tests report zero overflow and no page errors.

## Implementation checklist

- [x] Direction 1 mobile page hierarchy.
- [x] One-row service desk strip.
- [x] Phone query and primary action visible in the first viewport.
- [x] Three-row outbound/return journey hierarchy.
- [x] Shared mobile and desktop rendering.
- [x] Mobile, desktop, workspace, transport, registration, and performance checks passed.

final result: passed
