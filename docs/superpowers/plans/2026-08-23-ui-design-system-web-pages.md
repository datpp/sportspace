# UI Design System — Web Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every remaining `apps/web` page, form, and shared component off the ad-hoc `zinc-*` Tailwind classes onto the design tokens and shadcn components that the Foundation plan established — so the whole dashboard looks like one product instead of one page.

**Architecture:** Pure restyling. No routing, data-fetching, Server Action, or business-logic changes anywhere in this plan. Every change is one of a small set of mechanical substitutions (documented in the Substitution Table below) applied file by file. The Foundation plan already built and merged everything this plan consumes: `Button`, `Card`, `Input`, `Label`, `Badge` (`apps/web/src/components/ui/`), `StatusBadge` (`apps/web/src/components/status-badge.tsx`), `DashboardSidebar`, and the full token set in `apps/web/src/app/globals.css`.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 / shadcn-ui-on-Base-UI — all already installed, no new dependencies in this plan.

## Global Constraints

- **Restyle only.** Do not change any route, `Server Action`, data fetch, validation schema, or conditional-rendering logic. If a file needs a genuine behavior fix, stop and report it rather than folding it into a restyle commit.
- **Preserve every form input's `id`, `name`, `type`, `required`, `min`, `max`, `step`, `accept`, and `autoComplete` attribute exactly.** Server Actions read `formData.get('<name>')`, so a dropped `name` breaks submission silently and `tsc` will not catch it. This is the single highest-risk failure mode in this plan.
- **Preserve every `role="alert"`, `testID`, and any `aria-*` attribute** already present.
- **Preserve all Vietnamese copy exactly** — no rewording while restyling.
- Base UI (not Radix) backs shadcn here: `Button` has **no `asChild`**. To render a button-styled link, use `<Button render={<Link href="..." />}>Text</Button>`. Do not copy `asChild` examples from the internet.
- `StatusBadge` variants map to domain states as: `APPROVED`/`CONFIRMED`/`PAID`/`RESOLVED` → `success`; `PENDING` → `warning`; `REJECTED`/`CANCELLED`/`FAILED` → `danger`; `REFUNDED`/inactive/locked → `neutral`; sport/category tags → `info`.
- `pnpm test -- --run` and `pnpm exec tsc --noEmit` must both be clean in `apps/web` at the end of **every** task. `pnpm build` must be clean at the end of the final task.
- Vietnamese-only git commit messages; zero AI/Claude/Co-Authored-By mentions in any commit.

## Substitution Table

Every task applies these and only these. Where a file's existing classes differ slightly (e.g. `py-1.5` vs `py-2`), keep the component's own default rather than forcing the old spacing.

| Old (ad-hoc) | New |
|---|---|
| `<input className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" …>` | `<Input …>` from `@/components/ui/input` |
| `<select className="rounded border border-zinc-300 …">` | keep `<select>`, swap classes to `rounded-md border border-input bg-background px-2 py-1.5 text-sm` |
| `<button className="rounded bg-zinc-900 … text-white … dark:bg-zinc-50 dark:text-zinc-900">` (primary/submit) | `<Button …>` |
| `<button className="rounded border border-zinc-300 … dark:border-zinc-700">` (secondary) | `<Button variant="outline" …>` |
| `<button className="… text-red-600 …">` / destructive button | `<Button variant="destructive" …>` |
| `<label className="text-sm font-medium">` / `text-xs font-medium` | `<Label …>` from `@/components/ui/label` |
| `rounded border border-zinc-200 p-4 … dark:border-zinc-800` (card-ish container) | `<Card>` + `<CardContent>` from `@/components/ui/card` — **never pass `p-4` (or any `p-*`) to `CardContent`**, see the warning below |
| `text-zinc-500`, `text-zinc-600 dark:text-zinc-400`, `text-zinc-400` | `text-muted-foreground` |
| `text-red-600 dark:text-red-400` (error text) | `text-destructive` |
| `border-zinc-200 dark:border-zinc-800` (bare divider/border) | `border-border` |
| `bg-zinc-100 dark:bg-zinc-900` (subtle surface) | `bg-muted` |
| raw status string in JSX (e.g. `{venue.status}`) | `<StatusBadge variant="…">{label}</StatusBadge>` per the mapping above |

> **⚠️ `CardContent` padding trap** (found in Task 4's review, after the original wording here caused it): `Card` already supplies vertical padding via `py-(--card-spacing)`, and `CardContent` supplies horizontal padding via `px-(--card-spacing)`. Passing `p-4` in `CardContent`'s `className` makes `twMerge` treat it as a conflict and **delete** `px-(--card-spacing)`, leaving 32px vertical (Card's 16 + your 16) and 16px horizontal — visibly taller cards than the original. Write `<CardContent className="flex flex-col gap-2 text-sm">` with **no** `p-*` class; the result is exactly the 16px-all-round the old `p-4` div had.

---

## File Structure

No new files except one shared helper in Task 2. Everything else is in-place modification of existing files.

**Task 1** — `apps/web/src/components/list/{search-input,filter-select,pagination}.tsx`
**Task 2** — create `apps/web/src/components/page-state.tsx`; rewrite all 12 `error.tsx` + all 12 `loading.tsx` under `apps/web/src/app/**`
**Task 3** — `apps/web/src/app/page.tsx`, `apps/web/src/app/forgot-password/forgot-password-form.tsx`, `apps/web/src/app/reset-password/{page,reset-password-form}.tsx`
**Task 4** — `apps/web/src/app/admin/{page,config/page,disputes/page,users/page,venues/page}.tsx`
**Task 5** — `apps/web/src/app/merchant/{page,bookings/page,revenue/page,venues/page}.tsx`, `apps/web/src/app/merchant/venues/new/{page,venue-form}.tsx`
**Task 6** — `apps/web/src/app/merchant/venues/[venueId]/courts/{page,court-form}.tsx`, `.../courts/[courtId]/price-rules/{page,price-rule-form}.tsx`, `.../courts/[courtId]/blocks/{page,block-form}.tsx`
**Task 7** — `apps/web/src/app/merchant/venues/[venueId]/services/{page,service-form}.tsx`, `.../staff/{page,staff-form}.tsx`, `.../staff/[staffId]/shifts/{page,shift-form}.tsx`, `.../images/{page,image-upload-form}.tsx`

---

### Task 1: Shared list components

**Files:**
- Modify: `apps/web/src/components/list/search-input.tsx`, `filter-select.tsx`, `pagination.tsx`

**Interfaces:**
- Consumes: `Input`, `Button` from Foundation.
- Produces: nothing new — but these three components are rendered by 7 different list pages, so getting them right here means Tasks 4-7 inherit correct styling for free. Their props and behavior are unchanged.

**All three already have tests** (`search-input.test.tsx`, `filter-select.test.tsx`, `pagination.test.tsx`) — read them before editing. They query by `getByPlaceholderText`, `getByLabelText`, and `getByRole('button', { name })`, so preserving the placeholder text, the `<label>` wrapper, and the button labels keeps them passing. Do not modify these test files in this task.

- [ ] **Step 1: Migrate `search-input.tsx`**

Replace only the `<input>`'s `className`; keep `type="search"`, `value`, `onChange`, `placeholder`, and all the debounce/router logic untouched.

```tsx
// apps/web/src/components/list/search-input.tsx — add import, swap the element
import { Input } from '@/components/ui/input';

// …unchanged hook logic…

  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder ?? 'Tìm kiếm...'}
      className="max-w-xs"
    />
  );
```

- [ ] **Step 2: Migrate `filter-select.tsx`**

Keep the native `<select>` (shadcn's Select is a full Base UI popover component — swapping to it would be a behavior change, out of scope for this plan). Restyle it and its label:

```tsx
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      {label}
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
```

- [ ] **Step 3: Migrate `pagination.tsx`**

```tsx
// apps/web/src/components/list/pagination.tsx
import { Button } from '@/components/ui/button';

// …unchanged goTo() and the `if (totalPages <= 1) return null;` guard…

  return (
    <div className="flex items-center justify-between text-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
      >
        Trước
      </Button>
      <span className="text-muted-foreground">
        Trang {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
      >
        Sau
      </Button>
    </div>
  );
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass, zero errors. These three components are rendered inside several page tests; if any test breaks it is because it queried by a Tailwind class rather than by role/text — fix the test to query by role/text, do not revert the styling.

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/components/list
git commit -m "feat(web): áp dụng component dùng chung cho ô tìm kiếm, bộ lọc và phân trang"
```

---

### Task 2: Shared page-state helper + all error/loading files

**Files:**
- Create: `apps/web/src/components/page-state.tsx`
- Test: `apps/web/src/components/page-state.test.tsx`
- Modify: all 12 `error.tsx` and all 12 `loading.tsx` files under `apps/web/src/app/**`

**Interfaces:**
- Consumes: `Button` from Foundation.
- Produces: `<PageError message={string} onRetry={() => void} />` and `<PageLoading message={string} />` — Tasks 4-7 do not use these directly (they only touch `page.tsx`/form files), but any future page gets them.

- [ ] **Step 1: Find the exact file list**

Run: `cd apps/web && ls src/app/**/error.tsx src/app/**/loading.tsx`
Expected: 12 of each. Work from this list, not from memory.

- [ ] **Step 2: Write the failing test**

This repo uses `fireEvent` (there is **no** `@testing-library/user-event` dependency — do not import it), and `@testing-library/jest-dom/vitest` is loaded globally via `vitest.setup.ts`, so `toHaveTextContent`/`toHaveAttribute`/`toBeRequired` are available.

```tsx
// apps/web/src/components/page-state.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageError, PageLoading } from './page-state';

describe('PageLoading', () => {
  it('renders its message', () => {
    render(<PageLoading message="Đang tải danh sách cụm sân..." />);
    expect(screen.getByText('Đang tải danh sách cụm sân...')).toBeTruthy();
  });
});

describe('PageError', () => {
  it('renders its message with an alert role', () => {
    render(<PageError message="Có lỗi xảy ra." onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Có lỗi xảy ra.');
  });

  it('calls onRetry when the retry button is pressed', () => {
    const onRetry = vi.fn();
    render(<PageError message="Có lỗi xảy ra." onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

(Compare against the existing `apps/web/src/components/list/pagination.test.tsx` — it uses the same `fireEvent.click` + `getByRole('button', { name })` shape — and match its import style exactly.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --run page-state`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 4: Implement `page-state.tsx`**

```tsx
// apps/web/src/components/page-state.tsx
'use client';

import { Button } from '@/components/ui/button';

export function PageLoading({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --run page-state`
Expected: PASS (3 tests).

- [ ] **Step 6: Rewrite all 12 `error.tsx` files**

Each becomes this shape, keeping that file's own existing message string verbatim:

```tsx
'use client';

import { PageError } from '@/components/page-state';

export default function VenuesError({ reset }: { error: Error; reset: () => void }) {
  return <PageError message="Có lỗi xảy ra khi tải danh sách cụm sân." onRetry={reset} />;
}
```

Keep each file's existing default-export function name (`VenuesError`, `DisputesError`, …) and its existing props signature exactly — Next.js relies on the `error`/`reset` prop contract.

- [ ] **Step 7: Rewrite all 12 `loading.tsx` files**

```tsx
import { PageLoading } from '@/components/page-state';

export default function VenuesLoading() {
  return <PageLoading message="Đang tải danh sách cụm sân..." />;
}
```

Again: same export name, same message string as before.

- [ ] **Step 8: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass, zero errors.

- [ ] **Step 9: Verify no `zinc` remains in these files**

Run: `cd apps/web && grep -rn "zinc-" src/app/**/error.tsx src/app/**/loading.tsx src/components/page-state.tsx`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
cd apps/web && git add src/components/page-state.tsx src/components/page-state.test.tsx "src/app"
git commit -m "feat(web): thêm component trạng thái trang dùng chung cho màn tải và màn lỗi"
```

---

### Task 3: Auth-adjacent pages

**Files:**
- Modify: `apps/web/src/app/forgot-password/forgot-password-form.tsx`
- Modify: `apps/web/src/app/reset-password/page.tsx`, `apps/web/src/app/reset-password/reset-password-form.tsx`

**Note:** `apps/web/src/app/page.tsx` is deliberately **not** in this task — it contains no UI at all (it is a pure role-based `redirect()` and renders nothing), so there is nothing to restyle there. Do not modify it.

**Interfaces:**
- Consumes: `Button`, `Input`, `Label` from Foundation.
- Produces: nothing consumed by later tasks. The already-migrated `apps/web/src/app/login/` (done in Foundation Task 4) is the reference pattern for these — read it before starting.

- [ ] **Step 1: Read the reference**

Read `apps/web/src/app/login/login-form.tsx` and `apps/web/src/app/login/page.tsx`. These two files are exactly what the three form/page files in this task should look like when finished. Match their structure (`<Label htmlFor>` + `<Input>` pairs in a `flex flex-col gap-1.5`, error `<p role="alert" className="text-sm text-destructive">`, `<Button type="submit" disabled={pending}>`).

- [ ] **Step 2: Migrate `forgot-password-form.tsx`**

Apply the Substitution Table. Preserve exactly: the `id="email"`, `name="email"`, `type="email"`, `required`, `autoComplete="email"` attributes; the `role="alert"` on the error paragraph; the success-branch early return and its full Vietnamese message; and the `useActionState` wiring.

- [ ] **Step 3: Migrate `reset-password-form.tsx`**

Same treatment. Preserve exactly: the hidden `<input type="hidden" name="token">` (do **not** convert this one to `<Input>` — it is not a visible control and shadcn's styling would be meaningless on it), the `id`/`name`/`type`/`required`/`minLength={8}`/`autoComplete="new-password"` on the password field, and `role="alert"`.

- [ ] **Step 4: Migrate `reset-password/page.tsx`**

Swap the missing-token error paragraph's `text-red-600 dark:text-red-400` for `text-destructive`, and the heading to match login's (`text-2xl font-extrabold text-foreground`). Keep the `searchParams` await and the `token ? … : …` branch exactly.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass. `forgot-password-form.test.tsx` and the reset-password tests exist — they query by role/label, so they should survive untouched. If one breaks, read it and fix the query, do not weaken the assertion.

- [ ] **Step 6: Commit**

```bash
cd apps/web && git add src/app/page.tsx src/app/forgot-password src/app/reset-password
git commit -m "feat(web): áp dụng hệ thống thiết kế cho trang chủ và các trang mật khẩu"
```

---

### Task 4: Admin pages (first real `StatusBadge` usage)

**Files:**
- Modify: `apps/web/src/app/admin/page.tsx`, `admin/config/page.tsx`, `admin/disputes/page.tsx`, `admin/users/page.tsx`, `admin/venues/page.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`, `Label`, `StatusBadge` from Foundation; the restyled list components from Task 1.
- Produces: the first in-app consumers of `StatusBadge` — Tasks 5-7 follow the same pattern for their own status displays.

- [ ] **Step 1: Migrate `admin/venues/page.tsx`**

This page currently renders `Đăng ký lúc {…} — {venue.status}` as raw text and has approve/reject buttons. Convert:
- Each venue's `<div className="flex flex-col gap-2 rounded border border-zinc-200 p-4 …">` → `<Card>` with `<CardContent className="flex flex-col gap-2 text-sm">` (no `p-4` — see the CardContent padding trap warning in the Substitution Table).
- `{venue.status}` → `<StatusBadge variant={…}>{…}</StatusBadge>` using the Global Constraints mapping (`APPROVED` → `success`, `PENDING` → `warning`, `REJECTED` → `danger`). Render a Vietnamese label inside the badge, matching the labels already used in this page's own `FilterSelect` options (`Chờ duyệt` / `Đã duyệt` / `Từ chối`) — read them from the file, do not invent new wording.
- Approve button → `<Button size="sm">`; reject button → `<Button variant="destructive" size="sm">`.
- The existing thumbnail strip's `<img>` block and its `venue.images.length > 0` guard: leave the logic alone, only swap any `zinc-*` classes.

Keep both `<form action={approveVenue.bind(null, venue.id)}>` wrappers exactly as they are — the buttons stay `type="submit"` inside them.

- [ ] **Step 2: Migrate `admin/disputes/page.tsx`**

Same card + `StatusBadge` treatment for `{dispute.status}`. Read the file's existing status filter labels for the Vietnamese badge text.

- [ ] **Step 3: Migrate `admin/users/page.tsx`**

This page has lock/unlock actions and an `isLocked` filter. Locked state → `<StatusBadge variant="neutral">`, active → `variant="success"`. Lock button → `<Button variant="destructive" size="sm">`, unlock → `<Button variant="outline" size="sm">`.

- [ ] **Step 4: Migrate `admin/config/page.tsx` and `admin/page.tsx`**

`admin/config/page.tsx` is a settings form — apply `Label`/`Input`/`Button` substitutions, preserving every input's `name`, `type`, `min`, `max`, `step`, and `required` attribute exactly (these feed a Server Action). `admin/page.tsx` is a small landing page — just the text/color substitutions.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass, zero errors.

- [ ] **Step 6: Verify no `zinc` remains in admin**

Run: `cd apps/web && grep -rn "zinc-" src/app/admin`
Expected: no output.

- [ ] **Step 7: Manually verify in the browser**

Per CLAUDE.md's UI-testing rule: start the backend and web dev servers, log in as an admin, visit `/admin/venues`, `/admin/disputes`, `/admin/users`, `/admin/config`. Confirm status badges render with the right colors, the cards have visible elevation rather than flat borders, and approve/reject/lock actions still work. Report exactly what you did and observed.

- [ ] **Step 8: Commit**

```bash
cd apps/web && git add src/app/admin
git commit -m "feat(web): áp dụng hệ thống thiết kế cho các trang quản trị"
```

---

### Task 5: Merchant top-level pages

**Files:**
- Modify: `apps/web/src/app/merchant/page.tsx`, `merchant/bookings/page.tsx`, `merchant/revenue/page.tsx`, `merchant/venues/page.tsx`
- Modify: `apps/web/src/app/merchant/venues/new/page.tsx`, `merchant/venues/new/venue-form.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`, `Label`, `StatusBadge`; Task 1's list components; Task 4's established `StatusBadge` labelling pattern.

- [ ] **Step 1: Migrate `merchant/bookings/page.tsx`**

Currently shows `Trạng thái: {booking.status}` as raw text plus confirm/reject forms. Convert the booking rows to `<Card>`, the status to `<StatusBadge>` (`CONFIRMED` → `success`, `PENDING` → `warning`, `CANCELLED` → `danger`), the "Xác nhận" button to `<Button size="sm">`, and the reject form's text input to `<Input>` with `<Button variant="destructive" size="sm">`. The reject form's `<input type="text" name="reason" required>` must keep `name="reason"` and `required` — the Server Action reads it.

- [ ] **Step 2: Migrate `merchant/venues/page.tsx`**

Each venue is currently a whole-card `<Link>`. Keep it a `<Link>` (do **not** wrap in `Button` — this is a card-sized navigation target, not a button). Restyle the link's own classes to card-like: `flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-sm shadow-sm transition-colors hover:bg-muted`. Convert the `<span className="text-xs uppercase text-zinc-400">{venue.status}</span>` to a `<StatusBadge>`.

- [ ] **Step 3: Migrate `merchant/revenue/page.tsx`**

This page renders Recharts output. **Do not touch the `--rc-*` chart CSS variables or any chart config** — they are a separate, already-working token set. Only restyle the surrounding page chrome (headings, filter row, summary cards, muted text).

- [ ] **Step 4: Migrate `merchant/venues/new/{page,venue-form}.tsx` and `merchant/page.tsx`**

`venue-form.tsx` is a multi-field create form — apply `Label`/`Input`/`Button`, preserving every `name`/`required`/`type`/`step` attribute (including the province `<select>`, which keeps its native element per Task 1's decision). `merchant/page.tsx` is a small landing page.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass, zero errors.

- [ ] **Step 6: Verify no `zinc` remains in these files**

Run: `cd apps/web && grep -rn "zinc-" src/app/merchant/page.tsx src/app/merchant/bookings src/app/merchant/revenue src/app/merchant/venues/page.tsx src/app/merchant/venues/new`
Expected: no output.

- [ ] **Step 7: Manually verify in the browser**

Log in as a merchant, visit `/merchant`, `/merchant/venues`, `/merchant/bookings`, `/merchant/revenue`. Confirm the revenue chart still renders correctly (this is the highest-risk page in this task), status badges look right, and confirm/reject on a booking still works. Report what you observed.

- [ ] **Step 8: Commit**

```bash
cd apps/web && git add src/app/merchant/page.tsx src/app/merchant/bookings src/app/merchant/revenue src/app/merchant/venues/page.tsx src/app/merchant/venues/new
git commit -m "feat(web): áp dụng hệ thống thiết kế cho các trang chính của chủ sân"
```

---

### Task 6: Merchant court sub-pages

**Files:**
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`, `courts/court-form.tsx`
- Modify: `.../courts/[courtId]/price-rules/page.tsx`, `price-rules/price-rule-form.tsx`
- Modify: `.../courts/[courtId]/blocks/page.tsx`, `blocks/block-form.tsx`
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/court-form.test.tsx` (add attribute assertions)

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`, `Label`, `StatusBadge`; Task 1's list components.

- [ ] **Step 1: Migrate `courts/page.tsx` and `court-form.tsx`**

`courts/page.tsx` has per-court rows with a status toggle button, a "Chặn giờ" link, a "Bảng giá" link, and an "Ảnh cụm sân"/"Dịch vụ đi kèm" nav link pair at the top. Convert rows to `<Card>`, court status (`ACTIVE`/`MAINTENANCE`) to `<StatusBadge>` (`ACTIVE` → `success`, `MAINTENANCE` → `warning`), the toggle to `<Button variant="outline" size="sm">`. The nav links stay `<Link>` with `text-sm text-primary hover:underline`.

`court-form.tsx` — `Label`/`Input`/`Button`, preserving every attribute including the sport `<select>` and `basePrice` numeric input's `min`/`step`.

- [ ] **Step 2: Add attribute assertions to `court-form.test.tsx`**

This closes the Foundation review's deferred M-7 (no test guards the `name`/`required` contract that Server Actions depend on) for the form with the most fields. Add to the existing test file:

```tsx
it('giữ nguyên các thuộc tính name/required mà Server Action phụ thuộc', () => {
  render(<CourtForm venueId="v1" />);

  const name = screen.getByLabelText('Tên sân');
  expect(name).toHaveAttribute('name', 'name');
  expect(name).toBeRequired();

  const basePrice = screen.getByLabelText('Giá cơ bản');
  expect(basePrice).toHaveAttribute('name', 'basePrice');
  expect(basePrice).toHaveAttribute('type', 'number');
  expect(basePrice).toBeRequired();
});
```

(Read the real `court-form.tsx` for its actual label strings and field names before writing this — the above uses plausible names, not verified ones. Also read the existing `court-form.test.tsx` to match how it already renders the component and what props it passes.)

- [ ] **Step 3: Migrate `price-rules/{page,price-rule-form}.tsx`**

Rows → `<Card>`; the form's day-of-week `<select>`, time inputs, and price input keep every attribute; delete buttons → `<Button variant="destructive" size="sm">`.

- [ ] **Step 4: Migrate `blocks/{page,block-form}.tsx`**

Same treatment. The block form's `blockDate`/`startTime`/`endTime`/`reason` inputs keep their `type="date"`/`type="time"` and `name` attributes exactly.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass including the new assertions.

- [ ] **Step 6: Verify no `zinc` remains**

Run: `cd apps/web && grep -rn "zinc-" "src/app/merchant/venues/[venueId]/courts"`
Expected: no output.

- [ ] **Step 7: Manually verify in the browser**

As a merchant, open a venue's courts page, then its price-rules and blocks sub-pages. Create one price rule and one block to confirm the forms still submit correctly (this is the real test of the attribute-preservation constraint). Report what you observed.

- [ ] **Step 8: Commit**

```bash
cd apps/web && git add "src/app/merchant/venues/[venueId]/courts"
git commit -m "feat(web): áp dụng hệ thống thiết kế cho trang sân con, bảng giá và chặn giờ"
```

---

### Task 7: Merchant venue sub-pages (services, staff, shifts, images)

**Files:**
- Modify: `.../services/{page,service-form}.tsx`, `.../staff/{page,staff-form}.tsx`, `.../staff/[staffId]/shifts/{page,shift-form}.tsx`, `.../images/{page,image-upload-form}.tsx`
- Modify: `.../services/service-form.test.tsx`, `.../staff/staff-form.test.tsx` (add attribute assertions)

**Interfaces:**
- Consumes: `Card`, `Button`, `Input`, `Label`, `StatusBadge`.
- Produces: completion of the plan — after this task, `grep -rn "zinc-" apps/web/src` returns nothing.

- [ ] **Step 1: Migrate `services/{page,service-form}.tsx`**

Service rows → `<Card>`; inactive services (`!s.isActive`, currently rendered as the text `— đã vô hiệu hoá`) → `<StatusBadge variant="neutral">Đã vô hiệu hoá</StatusBadge>`; the "Vô hiệu hoá" button → `<Button variant="destructive" size="sm">`. `service-form.tsx` gets `Label`/`Input`/`Button` with every attribute preserved.

- [ ] **Step 2: Migrate `staff/{page,staff-form}.tsx` and `staff/[staffId]/shifts/{page,shift-form}.tsx`**

Same patterns. The shift form's time inputs keep `type="time"` and their `name` attributes.

- [ ] **Step 3: Migrate `images/{page,image-upload-form}.tsx`**

`image-upload-form.tsx` has `<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>` — **this one keeps its native `<input type="file">`**, do not convert it to `<Input>` (shadcn's Input styling on a file picker renders poorly and the `accept`/`required` contract is load-bearing for the upload Server Action). Restyle only its wrapper and the submit `<Button>`. The thumbnail grid's `<img>` elements and the `deleteImage` forms keep their structure; convert the "Xoá" button to `<Button variant="destructive" size="sm">`.

Note this file also currently has no `multiple` attribute on the file input — that is deliberate (it prevents concurrent uploads racing the backend). Do not add one.

- [ ] **Step 4: Add attribute assertions to `service-form.test.tsx` and `staff-form.test.tsx`**

Mirror Task 6 Step 2's pattern, using each form's real label strings and field names (read the files first).

- [ ] **Step 5: Run tests and typecheck**

Run: `cd apps/web && pnpm test -- --run && pnpm exec tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Verify the whole app is clean**

Run: `cd apps/web && grep -rn "zinc-" src/`
Expected: **no output at all** — this is the completion criterion for the entire plan.

Run: `cd apps/web && pnpm build`
Expected: exit 0, all routes compile.

- [ ] **Step 7: Manually verify in the browser**

As a merchant, open a venue's services, staff, staff-shifts, and images sub-pages. Upload one image and add one service to confirm both forms still submit (the file-upload form is the highest-risk one in this task). Report what you observed.

- [ ] **Step 8: Commit**

```bash
cd apps/web && git add "src/app/merchant/venues/[venueId]"
git commit -m "feat(web): áp dụng hệ thống thiết kế cho trang dịch vụ, nhân viên, ca làm và ảnh"
```
