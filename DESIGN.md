---
version: alpha
name: "BIMASATU"
description: "Administrative workspace for Bimas Islam Indramayu, using a restrained Sneat-based interface for clear operational tasks."
colors:
  primary: "#696cff"
  secondary: "#697a8d"
  heading: "#566a7f"
  background: "#f5f5f9"
  surface: "#ffffff"
  border: "#d4d9e0"
  success: "#71dd37"
  warning: "#ffab00"
  danger: "#ff3e1d"
typography:
  sans:
    fontFamily: "Public Sans, sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
rounded:
  DEFAULT: "0.5rem"
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  section-gap: "1rem"
  page-max: "100%"
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
---

# BIMASATU Design Context

## Overview

### Creative North Star

An orderly public-service workbench: familiar office software geometry, calm surfaces, readable data, and visible actions. The interface should feel like a dependable ledger and administration tool rather than a marketing dashboard.

### Product context and register

- **Audience and primary job:** Internal Bimas Islam staff who manage KUA operational data and monthly Jaspro/Transport reports.
- **Target market(s) and evidence:** Indonesian internal government administration; interface labels and business terms are Indonesian.
- **Locale(s) and language policy:** Indonesian UI and content; dates are presented in Indonesian; currency uses Rupiah formatting.
- **Usage scene:** Browser-based workflow on office laptops and personal phones. Tables can be wide, so horizontal scrolling must preserve all fields and actions.
- **Register:** Product interface. Task clarity, data accuracy, and familiarity take priority over expressive branding.
- **Memorable signature:** Clear annual ledger with month-level detail and direct management actions.
- **Restraint:** Keep text at normal, readable sizes; avoid bright oversized labels, decorative gradients, and unnecessary color emphasis in tables.
- **Anti-references:** No multi-tab wizard for Jaspro, no oversized dashboard typography, and no compact unreadable tables.
- **Token ownership/runtime mapping:** Existing runtime CSS remains canonical. This file records the values already implemented by `css/app.css`; it does not generate a second token system.

## Colors

Use the established BIMASATU/Sneat palette. Primary `#696cff` is reserved for main actions and focus. Body text uses `#697a8d`; headings use `#566a7f`. The page background is `#f5f5f9`, cards and dialogs are white, and form/table borders use `#d4d9e0`. Status colors must always be paired with readable status text; never rely on color alone.

## Typography

Use Public Sans through the existing global font setup. Body copy inherits the application size and color. Headings are restrained and use the existing heading color. Dense tables use a readable normal size and tabular alignment for amounts. Do not shrink long field labels or force uppercase text in data cells.

## Layout

Inherit the global BIMASATU/Sneat page shell. Jaspro has one content page: annual history is the entry view, period detail replaces the list within the same page, and a back action restores the year list. Upload, Master Rekening, and Pejabat & PPh are dialogs. Wide data tables scroll horizontally instead of hiding columns. At narrow widths, the three management actions wrap into a compact grid.

## Elevation & Depth

Use the existing white cards with subtle shadows and standard dialog backdrop. Avoid nested card-on-card decoration. Sticky table headings may be used inside scroll containers, but should not obscure the first row or dialog actions.

## Shapes

Inherit the 0.5rem control and card radius. Use neutral borders and restrained surfaces. Dashed borders are limited to file selection and empty states.

## Components

### Foundational visual states

Use native buttons and inputs with visible focus. Disable save controls while requests are pending and show the existing Bootstrap spinner. Respect `prefers-reduced-motion` for custom transitions.

### Buttons and actions

One primary action per decision area. Upload, Master Rekening, and Pejabat & PPh use clear labels. Destructive period deletion is visually separated and confirmed in a dialog. Important icon-only actions require an accessible label.

### Navigation and data display

Jaspro does not use tabs. The annual table provides month-level navigation with a Detail action. Detail includes account number and match status. Tables retain all columns through horizontal scrolling; amounts remain right-aligned and formatted in Rupiah.

### Forms and overlays

Use the shared native `<dialog id="dlg">` helper and global toast provider. Dialogs must remain within the viewport, keep their action buttons reachable, and remain open when a save fails. Saving actions show a spinner and prevent duplicate submissions.

### Iconography

Use the existing Boxicons icon set already loaded in `index.html`. Keep text labels next to primary actions.

### Motion

Use only brief feedback transitions and progress spinners. Honor reduced-motion preferences; do not animate large page regions.

### Content and data visualization

Use Indonesian action wording, short explanatory copy, `Rp` currency formatting, and explicit labels for bruto, PPh, bersih, Transport, and total diterima.

## Do's and Don'ts

- **Do:** Keep the annual ledger as the first and only page-level view.
- **Do:** Pair every account-matching status with readable explanatory text.
- **Don't:** Hide columns or truncate amounts to fit a small screen.
- **Don't:** add accent colors or oversized headings that make secondary information harder to read.