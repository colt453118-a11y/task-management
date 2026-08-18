# Spacing & layout conventions

A small, consistent spacing scale keeps pages feeling cohesive. Prefer these over ad-hoc values.

## Page rhythm
- **Between page sections:** `space-y-6` (24px). This is the default vertical rhythm inside a `(dashboard)` page.
- **Page shell padding** is owned by the layout, not the page — don't add outer page padding in `*-client.tsx`.

## Card grids
- **Dense KPI / stat tiles:** `gap-4` (16px), e.g. `grid grid-cols-2 gap-4 md:grid-cols-4`.
- **Feature cards** (projects, teams, people): `gap-4` (16px) at `md:grid-cols-2 lg:grid-cols-3`.
- Use `gap-6` (24px) only for two-column *content* layouts (e.g. main + side rail), not for card grids.

## Card internals
- **Card padding:** `p-5` (20px) for list/entity cards, `p-6` (24px) for modals and larger panels, `p-4` (16px) for compact tiles (`StatCard`).
- **Stack inside a card:** `space-y-3` / `space-y-4`.

## Shared primitives (use these instead of re-rolling)
- `components/ui/page-header.tsx` — `PageHeader` (title / subtitle / breadcrumb / actions).
- `components/ui/stat-card.tsx` — `StatCard` (KPI tile).
- `components/ui/accent-bar.tsx` — `AccentBar` (top gradient bar on cards).
- `components/ui/table.tsx` — `Table/THead/TBody/TR/TH/TD` (data tables).
- `components/ui/form-field.tsx` — `FormField` (labelled control + error).
- `components/ui/chip.tsx` — `StatusChip` / `PriorityChip` (token-driven status/priority pills).
- `lib/motion/variants.ts` — `containerVariants` / `itemVariants` / `staggerContainer()` / `fadeUpItem()`.
- `lib/theme/chart-colors.ts` — status/priority hex for charts (mirrors the CSS tokens).

## Form fields
Wrap inputs in `FormField` (uppercase hairline label + `role="alert"` error) rather than hand-rolling `<label>` + error markup.
