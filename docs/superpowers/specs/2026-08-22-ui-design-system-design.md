# UI Design System (Web + Mobile) — Design

## Goal

Both apps currently have no design system. Web (`apps/web`) is raw default-Tailwind markup written ad hoc across ~6 feature plans — flat 1px borders for structure instead of elevation, no shadows, no active-nav states, no icons, and `globals.css` still hardcodes `font-family: Arial` even though Geist fonts are already loaded via `next/font` and never actually applied. Mobile (`apps/mobile`) is worse in a different way: every screen hardcodes its own hex colors in a local `StyleSheet.create` (`#1d4ed8`, `#dc2626`, `#ccc`, ...), so there's no single source of truth for the app's palette and two screens can silently drift apart. Both read as "cheap" — the user's own words. This spec establishes a shared visual direction and the concrete tokens/components needed to apply it, without redesigning any information architecture.

## Visual Direction

Chosen via mockup review (see "Visuals validated" below): a bold, high-contrast "modern SaaS" direction.

- **Chrome:** dark slate (`#0f172a` primary, `#1e293b` secondary) — the web sidebar and the mobile header band.
- **Accent:** indigo (`#4f46e5` interactive elements, `#4338ca` badge/text-on-tint, `#e0e7ff` tint backgrounds).
- **Content areas:** light in light mode (`#f8fafc` background, white cards, `#e2e8f0` borders), matching dark slate tones in dark mode (`#1e293b` background, `#0f172a` cards, `#334155` borders) — dark mode is a full theme, not just a dark sidebar over light content.
- **Shape:** 8px radius on cards/inputs, 6px on small controls, full pill radius on badges and tab indicators.
- **Elevation:** subtle shadows on cards (`shadow-sm`) instead of bare borders as the primary structural device — borders become a secondary/subtle addition, not the only signal.
- **Typography:** Geist (already loaded, currently unused — `globals.css`'s hardcoded `font-family: Arial` gets removed), bold (700) for section headings, extra-bold (800) for page titles/brand wordmark.
- **Status/semantic colors:** one consistent badge palette used everywhere status is shown (bookings, venues, payments, disputes) instead of one-off classes per page:
  - Success (`APPROVED`/`CONFIRMED`/`PAID`): `bg-emerald-50 text-emerald-700` (light) / `bg-emerald-950 text-emerald-300` (dark)
  - Warning (`PENDING`): `bg-amber-50 text-amber-700` / `bg-amber-950 text-amber-300`
  - Danger (`REJECTED`/`CANCELLED`/`FAILED`): `bg-red-50 text-red-700` / `bg-red-950 text-red-300`
  - Neutral (`REFUNDED`, disabled/inactive states): `bg-slate-100 text-slate-600` / `bg-slate-800 text-slate-300`
  - Info/accent (category tags, e.g. sport type): `bg-indigo-50 text-indigo-700` / `bg-indigo-950 text-indigo-300`

**Visuals validated:** three full-direction mockups were shown (Minimal/Neutral, Warm/Approachable, Bold/Modern SaaS) — Bold/Modern SaaS was chosen. Two mobile translations were then shown (indigo used sparingly vs. a dark header band carried over from web) — the dark header band was chosen, applied to the four tab-root screens only (not every screen — see Mobile Architecture). Two dark-mode content strategies were then shown (chrome-only-dark vs. full-theme-dark) — full-theme-dark was chosen.

## Web Architecture

- **Component library: shadcn/ui**, added via its CLI (`npx shadcn@latest init`, then `npx shadcn@latest add button card badge input ...` per component as needed) — components land as owned source files under `apps/web/src/components/ui/`, not an opaque npm dependency, matching this project's existing "scaffold via CLI, then customize" convention (CLAUDE.md §0.2). Built on Tailwind (already present) + Radix primitives (accessible by default — focus management, keyboard nav, ARIA roles come for free instead of being hand-rolled per component as today).
- **Tokens** live in `apps/web/src/app/globals.css`'s existing `@theme inline` block, extended with the palette above as CSS custom properties (light values on `:root`, dark values under the existing `@media (prefers-color-scheme: dark)` block — same mechanism already used for the revenue-chart `--rc-*` variables, just generalized to the whole app instead of one chart).
- **Removed:** the hardcoded `font-family: Arial, Helvetica, sans-serif` on `body` in `globals.css` — replaced with `var(--font-sans)`, which already resolves to Geist via the `@theme inline` mapping that exists but is currently unused.
- **Shell first:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/merchant/layout.tsx`, `apps/web/src/app/admin/layout.tsx` (if one exists — confirm at planning time) and `apps/web/src/app/login/page.tsx` are the proving ground in the Foundation plan, since every other page inherits the shell's chrome.

## Mobile Architecture

- **No component library.** React Native UI libraries (Paper, Tamagui, etc.) are heavier and more opinionated than this app's scope needs, and none offer a CLI-scaffolding workflow analogous to shadcn's. Instead: a small hand-rolled theme module.
- **`apps/mobile/src/theme/`** — new directory exporting:
  - `colors.ts`: the same token values as web's CSS variables (light + dark), as a typed object.
  - `spacing.ts`, `radius.ts`, `typography.ts`: shared scales (spacing: 4/8/12/16/24/32; radius: 6/8/pill; typography: a small set of named sizes/weights matching web's heading/body scale).
  - `useTheme()`: a hook wrapping RN's built-in `useColorScheme()` to pick light/dark tokens — no new dependency.
- **Shared primitives** in `apps/mobile/src/components/`: `Button`, `Card`, `StatusPill`, `ScreenHeader` — each screen migrates its local `StyleSheet` color/radius/spacing literals to reference `theme` instead, and swaps hand-rolled buttons/cards for the shared primitives where the shapes match.
- **`ScreenHeader`** (the dark band) renders only on the four bottom-tab root screens (Tìm sân / Lịch đặt / Tìm kèo / Cá nhân) — deeper stack screens (venue detail, court slots, booking confirm, write review, etc.) keep a lighter standard nav header, so the heavy dark chrome doesn't repeat on every single screen in a booking flow.
- **Bottom tab bar** restyled to match: active icon/label in indigo, inactive in slate-400, background following the light/dark background token.

## Component Inventory

Both platforms need equivalent primitives, named consistently so migrating a page/screen means recognizing "this is a Button, this is a Card, this is a StatusPill" rather than reinventing per screen:

| Primitive | Web (shadcn) | Mobile (hand-rolled) |
|---|---|---|
| Button (primary/secondary/destructive/ghost) | `button` | `Button` |
| Card | `card` | `Card` |
| Status badge | `badge` (custom variants per semantic color above) | `StatusPill` |
| Text input | `input` | reuse existing `TextInput` styling, themed |
| Empty/loading state | plain Tailwind (no shadcn component needed) | existing per-screen pattern, themed |
| Section header / page title | plain Tailwind + typography tokens | `ScreenHeader` (root screens only) |

## Scope & Phasing

Full-coverage, split into separate plans (mirrors the pattern already used for this project's other multi-file feature plans — isolated worktree, subagent-driven implementation + review per plan):

1. **This spec.**
2. **Plan: Foundation** — shadcn init + token setup + Foundation component set (web); theme module + primitive components (mobile); applied to the shared shell (web: root/merchant/admin layouts + login; mobile: tab bar + auth screens) as the proving ground for the whole system before touching the long tail of pages/screens.
3. **Plan: Web pages** — every remaining page migrated to the new tokens/components: venues (admin + merchant, including venue-images sub-pages), courts, price-rules, blocks, services, staff, bookings, revenue, disputes, system-config, forgot/reset-password pages.
4. **Plan: Mobile screens** — every remaining screen migrated the same way: venue list/detail, court slots, booking confirm, my bookings, matches (list/detail/create), notifications, reviews, forgot-password, register.

## Testing

- No new visual-regression tooling is introduced (out of scope for a thesis timeline) — verification is manual, per the existing CLAUDE.md convention of checking UI changes in a real browser/simulator before reporting done.
- Existing unit/component tests (web: Vitest + Testing Library, asserting on `testID`/role/text; mobile: RN Testing Library, asserting on `testID`) are expected to mostly survive restyling untouched, since they don't assert on class names. Each migration plan's tasks must re-run the full existing suite and fix any test that turns out to assert on styling incidentally (e.g. a literal color string) rather than behavior — that's a signal the test was over-specified, not that the redesign is wrong.
- `tsc --noEmit` must stay clean on both apps at the end of every task, same as every other plan in this project.

## Out of Scope

- No logo/icon design or illustration work — the "SportSpace" wordmark stays typography-based.
- No animation/motion design beyond whatever shadcn/Radix components provide by default.
- No navigation/information-architecture changes — this is a visual restyle of existing screens and flows, not a rearrangement of them.
- No accessibility audit beyond what Radix (via shadcn) provides out of the box for web; mobile accessibility (screen reader labels, etc.) is unchanged from current behavior unless a specific primitive component's plan explicitly calls it out.
