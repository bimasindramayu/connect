# BIMASATU — Design Context

## Product and audience
BIMASATU is an internal operational workspace for Bimas Islam, Kementerian Agama Kabupaten Indramayu. The primary users are staff who manage monthly administrative, financial, and service records. The interface is Indonesian-first and prioritizes accurate data entry, clear status, and predictable recovery over promotional presentation.

## Visual direction
Use a restrained administrative-workspace visual language consistent with the existing Sneat-based shell. The interface should feel like a well-kept register: quiet surfaces, legible tables, compact but comfortable forms, and a consistent primary action. Avoid decorative gradients inside data tools, oversized hero metrics, excessive badges, and bright color used as decoration.

## Core tokens
- Primary: #696cff (existing application primary).
- Body text: #697a8d.
- Heading text: #566a7f.
- Page background: #f5f5f9.
- Surface: #ffffff.
- Subtle divider: #e5e7eb.
- Success, warning, danger, and info use existing Sneat semantic colors; never communicate state with color alone.

## Typography and density
- Application body: Public Sans, inherited from index.html.
- Use existing heading scale and weights; avoid extra-large text in operational screens.
- Data tables use right-aligned numeric values and nowrap amounts that must be compared.
- Keep form labels directly above controls, with helper text only where it changes the user's decision.

## Interaction contracts
- Use native dialog through the shared jpDlg helper for modal workflows. Preserve Escape close, visible close/cancel actions, focus behavior, and viewport-bounded scrolling.
- Use jpToast for server-confirmed success and actionable failure feedback. Do not show success before Supabase confirms the mutation.
- Disable duplicate submission and show an inline spinner while saving. Keep the current dialog and its values open after a failed save.
- Prefer a list-to-detail flow for archived records. Back returns to the annual register; period-specific settings remain scoped to the period.
- Tables remain horizontally scrollable when columns are needed for comparison; do not silently remove financial or identity fields on narrow screens.
- Respect prefers-reduced-motion; motion is only for small state transitions.

## Jaspro Transpo pattern
- The only top-level Jaspro screen is Riwayat Tahunan with Upload Laporan XLS and Setting Master Rekening actions.
- Upload and Master Rekening are modal workflows, not tabs.
- Detail opens one in-module page for the selected month. Nominatif preview, account matching, and downloads remain on that page.
- Pejabat and PPh settings are opened from the month detail as a modal and are saved to that month only.
- Unmatched account data remains visible and downloadable, with an explicit missing/unmatched state.
