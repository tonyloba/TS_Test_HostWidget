# Test Plan — External Iframe Search Widget (Playwright)

## Installation

- `npm init -y`
- `npm i -D @playwright/test`
- `npx playwright install`

## Covered scenarios
- Cross-origin iframe loads (host:8000 embeds widget:8001).
- Valid search (“playwright”) renders results and emits `searchMetrics` with totalResults > 0.
- Invalid search (“xyz”) shows “No results found” and emits `searchMetrics` with totalResults = 0.
- Clicking a result sends `resultClick` to the host.
- Keyboard accessibility: focus + Enter triggers `resultClick`.

## How to run
- Serve:
  - `npx http-server host -p 8000`
  - `npx http-server widget -p 8001`
- Install:
  - `npm i -D @playwright/test`
  - `npx playwright install`
 
## Run tests:
- `npx playwright test`
- `npx playwright test --ui`

## Assumptions / limitations
- Widget selectors are stable (#query, #searchBtn, .result-item, .no-results).
- Widget emits events using `postMessage` with `type` field.

## Report
- To open last HTML report run:
- `npx playwright show-report`

## 3 more tests with more time
- Host ignores messages from unexpected origins.
- Multi-search: ensure results reset properly between searches.
- Accessibility: tab order + aria-live updates validated.
