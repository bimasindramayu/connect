# Jaspro Transport UX Contract

## Product context

- **Audience:** Admin and PNBP NR operators working with monthly KUA nominative reports.
- **Primary job:** Upload a monthly report, match penghulu and bank-account information, verify gross/tax/net amounts, export payment files, and inspect prior monthly archives.
- **Market and locale:** Indonesia; UI language Indonesian; number and currency formatting `id-ID`; working timezone `Asia/Jakarta`.
- **Accessibility target:** WCAG 2.2 AA baseline for contrast, keyboard focus, names, and responsive behavior.
- **Primary surface:** Desktop-oriented administrative tool with phone access. Dense comparison tables remain tables and scroll horizontally when necessary.

## Business-context sources

| Domain | Authoritative source | Source type |
|---|---|---|
| Jaspro amounts, source columns, monthly archives | `README.md` section 14 | Maintained product documentation |
| Operator steps and use of G–J columns | `PANDUAN-INSTALASI.md` step 8 | Maintained operating guide |
| Table, trigger, and RLS rules | `bop.sql` section 12, Jaspro Transport | Database contract |
| Menu entitlement | `README.md` section 6 and `bop.sql` | Permission policy |

This contract records interface behavior only. Calculation, retention, and authorization rules remain owned by the sources above.

## Visual contract

- Project design guide: `DESIGN.md`.
- Runtime source: existing `css/app.css`, Bootstrap/Sneat variables, and the `.jp` scoped styles.
- Token model: existing runtime CSS is canonical; `DESIGN.md` mirrors accepted values.
- No new front-end framework or component library is introduced.

## Canonical UI map

| Capability | Canonical owner | Behavior |
|---|---|---|
| Navigation | `jpRender()` in `js/jaspro.js` | Three destinations: Laporan & Proses, Master Rekening, Riwayat |
| Forms | Native Bootstrap-styled controls | Labels visible; native month/year input choices |
| File upload | `jpLaporan()` and hidden file input | Visible file-picker button; drag-and-drop is optional |
| Tables | HTML tables plus `.jp-table-wrap .scroll` | Sticky header and horizontal scroll; full data retained |
| Search | Local filter in `jpInput()` and clear action `mclear` | Immediate filter; explicit clear button |
| Dialogs | Existing `jpDlg()` / `jpAsk()` helpers | Confirm replacement or destructive removal |
| Toast/status | Existing `jpToast()` / `jpStat()` helpers | Success only after server acknowledgement |
| Persistence | Supabase `jaspro_data` and `jaspro_periode` | Existing database and RLS remain unchanged |

## Workflow and navigation

### Laporan & Proses

1. Select the month and year.
2. Upload the nominative `.xlsx` file. Replacing an existing archive requires confirmation and affects only that period.
3. Inspect the report count and total event count. The source G–J table is available in a disclosure when needed.
4. Match the report with Master Rekening and run the matching process.
5. Review all row information, including KUA, NIP, rank, match status, account owner, event count, Jaspro gross, PPh, Jaspro net, Transport gross, source J, gross recalculation, and the final paid amount.
6. Export the Excel report or separate Jaspro/Transport CSV.

The PPh and signature settings are a collapsed disclosure in the same work surface. A setting change marks previous results as stale; the user must recalculate before using the new result.

### Master Rekening

A supporting destination for searching, importing, exporting, adding, editing, and removing bank-account records. It is not a mandatory stage on every monthly report.

### Riwayat

A supporting destination for selecting a year, inspecting monthly gross totals and event counts, opening a per-person detail table, replacing a period's report, or deleting a period archive after confirmation.

## Flow ledger

| Operation | Trigger | Pending / feedback | Result / recovery |
|---|---|---|---|
| Upload new period | Pilih File Excel | Reading indicator and inline result message | Save the selected period; preserve other periods |
| Replace period | Upload to a period that already has data | App confirmation | Replace only the selected period after confirmation |
| Match and review | Cocokkan dan tampilkan hasil | Button disabled when report or master is missing | Show row-level match and amount checks |
| Recalculate | Perbarui hasil pemeriksaan | Stale warning remains visible until recalc | Update review using current settings and report |
| Search accounts | Search field | Results update locally | Clear button empties query and restores focus |
| Edit account | Ubah | Existing dialog | Save Master Rekening and remain on the master list |
| Delete account | Hapus | Existing confirmation | Remove the selected master record and refresh the list |
| Export files | CSV Jaspro / CSV Transport / Unduh Laporan Excel | Browser file generation | Download the selected output; surface errors in the existing toast |
| Delete monthly archive | Hapus on Riwayat | Confirmation names the selected month | Permanently remove only that month; preserve other periods and master data |

## Tables and responsive behavior

- Keep all required columns. Do not hide fields on mobile.
- Tables scroll horizontally on narrow screens so the column relationship remains intact.
- Table headers remain visible during vertical scrolling.
- Important values are not truncated.
- Use readable 14px or larger text for table headings and cells.
- Inline edits have labels accessible through `aria-label` and retain a clear focus indicator.

## Validation and calculation display

The source file uses G (event count), H (total Jaspro), I (total Transport), and J (gross comparison value). The UI labels these source values clearly. The review distinguishes Jaspro gross, PPh, Jaspro net, Transport gross, gross comparison, and total paid. The UI must not relabel the gross comparison J as net payment.

## Async, state, and recovery

- Database mutations remain pessimistic; never announce success before Supabase acknowledges the write.
- Settings autosave uses the existing debounce. A period switch flushes pending settings before loading the next period.
- Replacing a period and deleting an archive require confirmation.
- When a report, account master, or settings change after review, mark the review stale and expose a recalculate action.
- On database errors, preserve the available input/context and report the error through existing page feedback/toast patterns.
- No offline mutation queue is defined.

## Permission and security

The Jaspro page continues to rely on existing route/menu authorization and Supabase RLS/trigger rules. UI simplification must not widen access, expose account information to other roles, or replace server-side permission checks.

## Verification

- JavaScript syntax check with `new Function(jsText)`.
- Static checks for three destinations, combined work screen, source G–J preview, full review data, gross-only per-person history detail, annual event total, and current asset cache.
- Contrast sampled for text, secondary text, borders, and focus/primary controls.
- Browser screenshots, real keyboard walkthrough, touch-device inspection, and assistive-technology testing are not claimed unless separately executed.
