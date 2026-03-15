# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

This is a **no-build, serverless SPA**. There is no npm, no bundler, no test suite.

To deploy changes, simply push to GitHub — Pages auto-deploys within 1–2 minutes:
```
git add index.html assistenz.html && git commit -m "..." && git push
```

To preview locally, open the HTML files directly in a browser (`open index.html`).

## Architecture

Two standalone HTML files (CSS + JS all inline, no external dependencies):

| File | Audience | JSONBin ID |
|------|----------|------------|
| `index.html` | Oberärzte (senior physicians) | `694548d1d0ea881f403427e3` |
| `assistenz.html` | Assistenzärzte (residents) | `699ffb53ae596e708f4b3de5` |

**Data flow:**
1. On login, the app fetches `{ employees, state }` from JSONBin.io via `DataService.load()`
2. Every cell edit calls `DataService.save(state)` via PUT to JSONBin.io
3. The API key (`X-Master-Key`) is stored in `localStorage` under key `jsonbin_key`
4. `urlaubsplaner_2026.json` is a local backup/reference file, not used at runtime

**Core JS structure (inline `<script>` at bottom of each file):**
- `CONFIG` — global config object: `years`, `binId`, `apiKey`, `employees[]`, `groupOrder[]`, `groupColors{}`, `schoolHolidays[]`
- `DataService` — static class with `load()` and `save(state)` methods (JSONBin.io REST calls)
- `App` — main class instantiated as `window.app`; handles rendering, drag, tabs, import/export

**Absence type codes:**
- `U` = Urlaub (vacation)
- `D` = Dienstreise (business trip)
- `F` = Fortbildung (training/conference)
- `T` = Sonstiges (custom/other)

**Employee groups** (index.html `CONFIG.groupOrder`): Chef, Privat, TAVI, TEER, Herzkatheter, Echo, EPU, Intensiv, Pneumo, Ambulanz — used for color-coding rows and coverage validation.

**assistenz.html extras:** Has a "Skills" tab (`tab-skills` / `skillsView`) showing rotation assignments per resident. Skills list is in `CONFIG.skills`.

## Key Implementation Notes

- **Sticky grid layout**: The calendar uses CSS Grid with `position: sticky` for frozen row/column headers. Safari requires `-webkit-sticky` and `!important` overrides throughout.
- **Drag-to-fill**: Mouse/touch drag across cells sets or clears absence. `dragStartVal` toggles between set/clear based on the initial cell state. `dragLock` flag prevents re-entry.
- **Coverage validation**: `validateCoverage(dateObj)` checks that required groups are present each day; violations appear in a sticky validation row (row 3, red background).
- **Employee sorting**: `sortEmployees()` orders by `CONFIG.groupOrder` index of each employee's primary group (`getPrimaryGrp()`).
- **Both files must stay in sync** structurally (CSS, drag logic, DataService, auth flow) — changes to shared patterns should be applied to both.
