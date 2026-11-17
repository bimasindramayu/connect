# UX Contract — Jaspro Transport

## Scope

This contract governs `js/jaspro.js` and the Jaspro-specific selectors in `css/app.css`. It preserves the existing Supabase schema and calculation rules.

## Navigation and states

1. The menu has one page-level view only. There are no internal tabs or step navigation.
2. The initial view is **Riwayat Tahunan** and the selected year is the browser's current calendar year.
3. Changing the year refreshes the annual summary. A year with no saved reports displays an explicit empty state and an Upload action; it must not silently switch to another year.
4. Selecting **Detail** replaces the annual list with the selected month detail inside the same page. **Kembali ke riwayat** restores the annual view and the selected year.
5. The page header always exposes three actions: Upload laporan XLS, Master Rekening, and Pejabat & PPh. Each opens a dialog, not another tab or route.

## Dialog behavior

### Upload laporan XLS

- Month, year, and a `.xlsx` file are required.
- The selected year is seeded from the current annual-history filter; the month defaults to the latest saved period in that year or the current calendar month.
- Uploading a period with an existing report requires explicit replacement confirmation. The confirmation stays open while saving.
- Validation, duplicate schedule, or server errors keep the user informed and do not report success.

### Master Rekening

- Master Rekening remains global in `jaspro_data` (`id = 1`).
- Edits are held in a dialog draft until Save is selected. Cancel closes the dialog without applying the draft.
- Each row requires a penghulu name and account number. XLS import supports merge or replace; export downloads the current draft.
- Save shows a spinner, prevents duplicate submission, closes only after server success, and leaves the dialog content intact on failure.

### Pejabat & PPh

- Pejabat/signatory fields and PPh values are stored in the selected monthly `jaspro_periode` settings, preserving historical month-specific values.
- Month and year can be changed inside the dialog; values are loaded from that period or initialized from defaults.
- PPh is deducted from Jaspro only. Transport is not subject to PPh.
- Save shows a spinner, validates rates between 0 and 100 percent, closes only after server success, and retains values on failure.

## Monthly detail and nominative preview

- The detail table shows penghulu, KUA, NIP, grade, period totals, and account number.
- Account resolution uses `JX.matchPenghulu` and the Master Rekening index. Exact, fuzzy, ambiguous, missing, and manually confirmed matches remain distinguishable.
- If no reliable account match exists, show a visible warning and do not pretend that an account was matched. A source-provided account number may be displayed as an unverified value.
- **Cocokkan & Pratinjau Data** recreates the existing nominative preview. Account number, account owner, and grade can be adjusted in the preview for the current download only.
- CSV Jaspro, CSV Transport, and Excel nominative downloads use the preview rows and existing `JX.buildDisbursementRows`, `JX.buildCsvContent`, and `JX.buildOutputWorkbook` logic.
- Preview-only corrections never write back to Master Rekening or the archived report.

## Data and calculation invariants

- Master Rekening source of truth: `jaspro_data` (`id = 1`).
- Monthly archive source of truth: one row per month in `jaspro_periode`, key `YYYY-MM`.
- H/I/G/J calculation: G is event count; H is total Jaspro for the row; I is total Transport for the row; J is the gross comparator. Per-event values are H ÷ G and I ÷ G.
- PPh is deducted from Jaspro only. Compare J with gross H + I before PPh; net payable is Jaspro after PPh plus Transport.
- Existing archive validation, duplicate-schedule checks, RLS, triggers, and non-destructive migration in `bop.sql` section 12 remain authoritative.

## Async, errors, and accessibility

- Save actions disable themselves and show a spinner while pending.
- Duplicate submissions are blocked. Server errors keep the relevant dialog open with its entered values.
- Period deletion remains in its confirmation dialog until the server confirms success.
- Native dialog behavior provides modal focus management and Escape dismissal; focus returns to the trigger when the dialog closes.
- Buttons have visible focus states and meaningful labels. Tables keep all values accessible with horizontal scrolling on narrow screens.
- Respect `prefers-reduced-motion` for custom animation; do not convey status through color alone.

## Verification evidence

- JavaScript syntax checked with `new Function` against the complete `js/jaspro.js` source.
- Pure calculation check: G=16, H=Rp1.600.000, I=Rp800.000, J=Rp2.400.000, Golongan IV/a at 15% produced Rp100.000 Jaspro/event, Rp50.000 Transport/event, Rp240.000 PPh, and Rp2.160.000 net payable.
- Browser-based visual, keyboard, and live Supabase integration testing remains required before production merge.