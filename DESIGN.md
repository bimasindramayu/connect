---
version: alpha
name: "BIMASATU"
description: "Internal service-administration interface for Bimas Islam Indramayu."
colors:
  primary: "#696cff"
  text: "#344054"
  secondary-text: "#475467"
  background: "#f5f5f9"
  surface: "#ffffff"
  border: "#d0d5dd"
typography:
  sans:
    fontFamily: "'Public Sans', sans-serif"
    fontSize: "1rem"
    lineHeight: "1.5"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.875rem"
    lineHeight: "1.5"
rounded:
  DEFAULT: "0.5rem"
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  page-gutter: "1.5rem"
  section-gap: "1rem"
components:
  button:
    minHeight: "2.375rem"
    fontSize: "0.875rem"
  input:
    minHeight: "2.5rem"
    fontSize: "1rem"
  table:
    bodyFontSize: "0.875rem"
    headerFontSize: "0.875rem"
  card:
    borderRadius: "0.5rem"
    shadow: "0 2px 6px rgba(67,89,113,.12)"
---

# BIMASATU Design System

## Overview

### Creative North Star

An office worksheet for public-service administration: the quiet clarity of a well-kept ledger, adapted for a browser. The interface should help an operator identify the current period, complete the task, and verify the recorded result without learning a decorative dashboard.

### Product context and register

- **Audience and primary job:** Admin and PNBP NR operators who prepare, verify, and archive monthly Jaspro Transport nominative reports for KUA.
- **Target market and evidence:** Indonesian Ministry of Religious Affairs administration; workflow and terminology are documented in `README.md` section 14 and `PANDUAN-INSTALASI.md` step 8.
- **Locale and language:** Indonesian UI, Indonesian number and Rupiah formatting (`id-ID`), local reporting period.
- **Usage scene:** Desktop-first administrative work with spreadsheet-like records, also reachable from office phones.
- **Register:** Product/admin. Task clarity, readable data, and predictable controls take priority over promotional visuals.
- **Memorable signature:** One continuous **Laporan & Proses** workspace; Master Rekening and Riwayat are supporting destinations, not compulsory workflow stages.
- **Restraint:** No giant metric typography, decorative stepper, loud colored headings, tiny uppercase labels, or stacked cards that repeat the same facts.
- **Anti-references:** Marketing dashboards, neon gradients, dense microcopy, inaccessible pale-grey text, and interfaces that require the operator to open multiple screens to finish one monthly report.
- **Token ownership/runtime mapping:** Existing runtime CSS remains canonical (Model B). The shared foundation is `css/app.css` and the existing Sneat/Bootstrap theme variables. Jaspro-specific overrides are scoped under `.jp` in the same stylesheet. This file documents the accepted values; it does not generate a second token system.

## Colors

- **Primary `#696cff`:** Reserved for the primary action, selected navigation underline, and focus indication. It is not used as body text or large decorative blocks.
- **Text `#344054`:** Main headings, table values, labels, and important data.
- **Secondary text `#475467`:** Help text, descriptions, and supporting labels. Do not fade important instructions into low-contrast grey.
- **Background `#f5f5f9` and surface `#ffffff`:** Neutral page and content surfaces.
- **Border `#d0d5dd`:** Table boundaries, field outlines, and section separation.
- Status can use the application's existing semantic badges, but meaning is never communicated by color alone; include readable words such as “Sesuai”, “Selisih”, or “Perlu ditinjau”.

## Typography

Use Public Sans from the existing application. Normal body text is 16px. Supporting descriptions and table content are at least 14px. Table headers are 14px, sentence case, and medium weight; avoid tiny uppercase captions and excessive letter spacing. Use dark, readable text colors for both content and values. Important financial figures use tabular numerals and a moderate weight rather than oversized display numbers. Do not use italic or all-caps styling as a substitute for hierarchy.

## Layout

The Jaspro page has one compact heading, three simple destinations, and one active work surface. The normal monthly workflow is completed in **Laporan & Proses**: period, file, matching, review, and download. Master Rekening is opened only when account data needs maintenance. Riwayat is opened to inspect archived months.

Keep sections in natural document flow. Separate them with spacing and thin borders, not repeated cards. The source-file preview is a disclosure so the full G–J data remains available without dominating the default view. Review and history tables preserve every required column and use horizontal scrolling on narrow screens; do not silently hide business data.

## Elevation & Depth

Use flat white surfaces with a fine border. The application's existing subtle card shadow is acceptable for common cards but should not be repeated on every subsection. Avoid multiple nested cards. Sticky table headers use an opaque neutral surface.

## Shapes

Use the existing modest corner radius: 6px for controls and 8px for sections. Buttons are rectangular with a restrained radius, not pills. Use thin dividers to separate groups.

## Components

### Foundational states

Buttons and fields use the existing Bootstrap/Sneat foundation. Keep a visible keyboard focus ring. Busy/disabled controls retain their geometry. Field and table text remain readable in default, hover, focus, disabled, and validation states.

### Buttons and actions

Each decision area has one clear primary action. Use explicit verbs: “Pilih File Excel”, “Cocokkan dan tampilkan hasil”, and “Unduh Laporan Excel”. Keep import/export and row utilities neutral. Destructive actions remain visually separated and require the existing confirmation flow.

### Navigation and data display

Use three simple text navigation controls: **Laporan & Proses**, **Master Rekening**, and **Riwayat**. Do not use a four-step wizard for a workflow that can be completed on one screen. Tables retain headers, full values, and their comparison columns; horizontal overflow is explicit.

### Forms and overlays

Use labeled native month/year selects and inputs. The file picker button is the non-drag alternative to upload. Advanced PPh and signature fields stay in a collapsed disclosure until needed. Continue using the application's existing dialog and toast helpers.

### Iconography

Use the existing Boxicons family. Icons supplement labels; they do not replace labels for important actions.

### Motion

No decorative animation. Use only existing short interaction feedback and respect `prefers-reduced-motion`.

### Content and data

Use plain Indonesian. Label nominal type explicitly: gross (bruto), deduction (PPh), net (bersih), and paid (dibayarkan). Format currency and counts with Indonesian locale. Distinguish the source J gross comparator from the calculated amount after tax.

## Do's and Don'ts

- **Do:** Keep the regular monthly task on one screen and expose source detail when the operator asks for it.
- **Do:** Keep financial amounts, account identifiers, event counts, and verification results available in their tables.
- **Do:** Use dark text and a minimum 14px size for table and supporting copy.
- **Don't:** Use a large colorful stepper, oversized KPI cards, tiny uppercase labels, or pale low-contrast text.
- **Don't:** Hide necessary table columns or change the business calculations for visual convenience.
