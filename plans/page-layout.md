# Page Layout View — Implementation Plan

> **STATUS: IMPLEMENTED.** Page layout mode is fully working with Letter/A4 sizes, Portrait/Landscape orientation, white pages with drop shadows, proper margins, and automatic page breaks. Systems reuse DP line-breaking from wrap mode. Layout, page size, and orientation persisted to localStorage.

## Goal

Add a "Page" layout mode that renders the score on fixed-size pages (Letter or A4),
displayed like a PDF viewer with a gray background, white page rectangles with
drop shadows, and proper margins. Systems flow across pages with automatic page
breaks.

## Design

- **Page sizes**: Letter (8.5x11" = 816x1056 at 96 DPI), A4 (210x297mm = 794x1123 at 96 DPI)
- **Margins**: 72px (0.75") on all sides
- **Inter-page gap**: 24px gray gap between pages (PDF viewer style)
- **Page background**: `#888` gray on the score container, white page rectangles
- **Title/author**: rendered on page 1 only, consuming vertical space
- **System assignment**: reuse DP line-breaking from wrap mode, then assign systems
  to pages based on remaining vertical space

## Architecture

Page mode reuses most of wrap mode:
1. Single-line layout (shared)
2. `computeSystemBreaks()` for horizontal line breaks (shared)
3. **NEW**: `assignSystemsToPages()` — vertical page-break algorithm
4. Reflow elements with per-page Y offsets (similar to wrap, but with page offsets)
5. Draw page backgrounds in `quickDraw()` before score elements

## Changes

### `constants.js`
- Add `'page'` to valid layout modes
- Add page size state: `getPageSize()`, `setPageSize()`
- Export `PAGE_SIZES` constant

### `typeset.js`
- Add `scorePageLayout()` function
- Store page geometry on `window` for `quickDraw()` to draw backgrounds
- Modify `quickDraw()` to draw page backgrounds when in page mode

### `main.js`
- Update `toggleLayout()` to cycle through scroll → wrap → page
- Add page size selector UI

### `index.html`
- Add page size dropdown (`<select>`)
- Add CSS for page-mode gray background
