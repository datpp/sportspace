# UI Design System — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the design-token foundation and core reusable components on both platforms, proven out on a small representative slice of screens (web: shared shell + login; mobile: auth flow + one tab-root screen + nav chrome) — everything else migrates in two follow-up plans (`docs/superpowers/plans/<date>-ui-design-system-web-pages.md`, `...-mobile-screens.md`), not this one.

**Architecture:** Web adopts shadcn/ui (CLI-scaffolded into `apps/web/src/components/ui/`) with tokens layered into the existing `globals.css` `@theme inline` mechanism, keeping the project's current `@media (prefers-color-scheme: dark)` dark-mode switch rather than shadcn's default `.dark`-class toggle (this app has no theme-toggle UI and none is being added — see Task 1). Mobile gets a hand-rolled `apps/mobile/src/theme/` token module (no new UI library) plus four shared primitive components (`Button`, `Card`, `StatusPill`, `ScreenHeader`) that replace the per-screen hardcoded `StyleSheet` hex values.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 (web, all already present) + shadcn/ui (new); React Native / Expo SDK 57 (mobile, already present), no new mobile dependency.

## Global Constraints

- Full design direction, token values, and component inventory: `docs/superpowers/specs/2026-08-22-ui-design-system-design.md` — read it before starting, this plan's tasks implement it but don't repeat every rationale.
- Palette (both platforms must match exactly):
  - Chrome (always dark, both themes): `#0f172a` primary / `#1e293b` secondary.
  - Accent: `#4f46e5` (light-mode primary) / `#6366f1` (dark-mode primary, brighter against dark bg) / `#4338ca` (badge/tint text) / `#e0e7ff` (badge/tint bg, light) / `#1e1b4b` (badge/tint bg, dark).
  - Content, light: bg `#f8fafc`, card `#ffffff`, border `#e2e8f0`, muted text `#64748b`, text `#0f172a`.
  - Content, dark: bg `#1e293b`, card `#0f172a`, border `#334155`, muted text `#94a3b8`, text `#f1f5f9`.
  - Status semantic pairs (bg/text, light → dark): success `#ecfdf5`/`#047857` → `#022c22`/`#6ee7b7`; warning `#fffbeb`/`#b45309` → `#451a03`/`#fcd34d`; danger `#fef2f2`/`#b91c1c` → `#450a0a`/`#fca5a5`; neutral `#f1f5f9`/`#475569` → `#1e293b`/`#cbd5e1`; info `#eef2ff`/`#4338ca` → `#1e1b4b`/`#c7d2fe`.
- Radius: 8px default, 6px small controls, full pill for badges/tabs.
- No icon library added in this plan (out of scope per the spec — tab bar stays text-only, restyled in color/weight only).
- No theme-toggle UI added on either platform — dark mode stays automatic (OS preference via `prefers-color-scheme` on web, `useColorScheme()` on mobile).
- TDD: write the failing test before the implementation, for every component task.
- Every existing `testID` on every screen touched in this plan must be preserved exactly — tests assert on them and they must keep passing.
- `tsc --noEmit` clean on `apps/web` and `apps/mobile` at the end of every task.
- Consult Context7 for shadcn/ui CLI specifics in Task 1 — its Tailwind v4 setup conventions can differ from what's guessed here; verify before locking in the exact command/file output.
- Vietnamese-only git commit messages; zero AI/Claude/Co-Authored-By mentions in any commit.

---

## File Structure

**Web — new:**
- `apps/web/components.json` (shadcn config, CLI-generated)
- `apps/web/src/components/ui/*.tsx` (shadcn-generated: `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `label.tsx`)
- `apps/web/src/components/status-badge.tsx` (+ `.test.tsx`)
- `apps/web/src/components/dashboard-sidebar.tsx` (+ `.test.tsx`)

**Web — modified:**
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/merchant/layout.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/components/logout-button.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/login/login-form.tsx`

**Mobile — new:**
- `apps/mobile/src/theme/colors.ts`
- `apps/mobile/src/theme/spacing.ts`
- `apps/mobile/src/theme/radius.ts`
- `apps/mobile/src/theme/typography.ts`
- `apps/mobile/src/theme/statusColors.ts`
- `apps/mobile/src/theme/useTheme.ts`
- `apps/mobile/src/theme/index.ts`
- `apps/mobile/src/components/Button.tsx` (+ `__tests__/Button.test.tsx`)
- `apps/mobile/src/components/Card.tsx`, `StatusPill.tsx` (+ `__tests__/Card.test.tsx`, `__tests__/StatusPill.test.tsx`)
- `apps/mobile/src/components/ScreenHeader.tsx` (+ `__tests__/ScreenHeader.test.tsx`)

**Mobile — modified:**
- `apps/mobile/src/screens/auth/LoginScreen.tsx` (+ its existing test file)
- `apps/mobile/src/screens/auth/RegisterScreen.tsx` (+ its existing test file)
- `apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx` (+ its existing test file)
- `apps/mobile/src/screens/venues/VenueListScreen.tsx` (+ its existing test file)
- `apps/mobile/src/navigation/RootNavigator.tsx`

---

### Task 1: shadcn/ui init + design tokens (web)

**Files:**
- Create: `apps/web/components.json`, `apps/web/src/components/ui/button.tsx` (from CLI)
- Modify: `apps/web/src/app/globals.css`, `apps/web/package.json`

**Interfaces:**
- Produces: CSS custom properties consumable by every later web task — `--background`, `--foreground`, `--card`, `--card-foreground`, `--border`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--sidebar`, `--sidebar-foreground`, `--sidebar-muted`, `--sidebar-active-bg`, `--sidebar-active-border`, mapped into `@theme inline` as `--color-background`, `--color-foreground`, etc. (Tailwind v4's convention — a `bg-background` utility class becomes available once `--color-background` exists in `@theme`). Also produces the `button` shadcn primitive other web tasks import from `@/components/ui/button`.

- [ ] **Step 1: Consult Context7 for the current shadcn CLI + Tailwind v4 flow**

Run: `npx ctx7@latest library "shadcn/ui" "init Next.js App Router Tailwind v4 CSS variables"` then `npx ctx7@latest docs <resolved-id> "npx shadcn init flags, components.json fields, Tailwind v4 CSS variable output shape"`. Confirm: the exact `init` invocation for a Next.js App Router + Tailwind v4 project, whether it expects a `.dark` class or supports staying media-query-driven, and the exact CSS variable names it generates (this plan's variable names above are the target shape post-adaptation, not necessarily what the CLI outputs verbatim — reconcile the two, don't guess).

- [ ] **Step 2: Run the CLI**

Run (adjust flags per what Context7 confirmed, from `apps/web`): `npx shadcn@latest init`
Expected: creates `apps/web/components.json`, adds `apps/web/src/components/ui/` (may seed 1-2 default components), adds `class-variance-authority`/`clsx`/`tailwind-merge`/`lucide-react`-adjacent dependencies to `apps/web/package.json` (shadcn's own deps — this is expected, not scope creep), and rewrites parts of `apps/web/src/app/globals.css`.

- [ ] **Step 3: Reconcile the generated CSS with this project's existing dark-mode mechanism**

The CLI likely wires dark mode via a `.dark` class selector (its default). This project has no theme-toggle UI and isn't getting one in this plan — dark mode must stay automatic via `@media (prefers-color-scheme: dark)`, matching the mechanism already in `globals.css` for the `--rc-*` chart variables. Rewrite whatever the CLI generated so the dark variable overrides live under `@media (prefers-color-scheme: dark) { :root { ... } }` instead of a `.dark` class block, then set every variable to this plan's Global Constraints palette values (not shadcn's default slate/zinc theme). The `@theme inline` block maps `--color-x: var(--x)` for every token — extend it for every new variable, following the exact pattern the existing `--color-background`/`--color-foreground` lines already use.

Resulting shape (adapt exact CLI output to this, don't copy verbatim if the CLI's real structure differs):

```css
@import "tailwindcss";

:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --border: #e2e8f0;
  --muted-foreground: #64748b;
  --primary: #4f46e5;
  --primary-foreground: #ffffff;
  --sidebar: #0f172a;
  --sidebar-foreground: #f1f5f9;
  --sidebar-muted: #94a3b8;
  --sidebar-active-bg: #1e293b;
  --sidebar-active-border: #818cf8;
  --radius: 0.5rem;

  /* existing --rc-* chart variables stay unchanged */
  --rc-grid: #e1e0d9;
  /* ... */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-border: var(--border);
  --color-muted-foreground: var(--muted-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-muted: var(--sidebar-muted);
  --color-sidebar-active-bg: var(--sidebar-active-bg);
  --color-sidebar-active-border: var(--sidebar-active-border);
  --radius-md: var(--radius);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #1e293b;
    --foreground: #f1f5f9;
    --card: #0f172a;
    --card-foreground: #f1f5f9;
    --border: #334155;
    --muted-foreground: #94a3b8;
    --primary: #6366f1;
    --primary-foreground: #ffffff;
    /* --sidebar-* stay the same in dark mode — the chrome is always dark */

    /* existing --rc-* dark overrides stay unchanged */
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

Note the fixed bug: `body`'s `font-family` changes from the hardcoded `Arial, Helvetica, sans-serif` to `var(--font-sans)`, which now actually resolves to Geist (loaded in `layout.tsx` but previously never applied).

- [ ] **Step 4: Install the `button` component and confirm the tokens render**

Run: `npx shadcn@latest add button` (from `apps/web`)
Expected: creates `apps/web/src/components/ui/button.tsx`.

- [ ] **Step 5: Verify visually**

Start the web dev server, load any page, confirm: page background/text use the new palette, Geist font is visibly applied (not the previous generic sans-serif), and toggling OS dark mode (e.g. macOS System Settings → Appearance) flips the page's background/text without a page reload. Report what you observed.

- [ ] **Step 6: Verify build**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd apps/web && git add components.json src/components/ui src/app/globals.css package.json ../../pnpm-lock.yaml
git commit -m "feat(web): khởi tạo shadcn/ui và design token cho toàn bộ dashboard"
```

---

### Task 2: Core shadcn components + `StatusBadge`

**Files:**
- Create: `apps/web/src/components/ui/card.tsx`, `badge.tsx`, `input.tsx`, `label.tsx` (from CLI)
- Create: `apps/web/src/components/status-badge.tsx`
- Test: `apps/web/src/components/status-badge.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `<StatusBadge variant="success" | "warning" | "danger" | "neutral" | "info">{children}</StatusBadge>` — every later web task that renders a booking/venue/payment status uses this instead of a one-off `className`.

- [ ] **Step 1: Install the remaining core components**

Run (from `apps/web`): `npx shadcn@latest add card badge input label`
Expected: creates the four files under `apps/web/src/components/ui/`.

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/status-badge.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders children', () => {
    render(<StatusBadge variant="success">Đã duyệt</StatusBadge>);
    expect(screen.getByText('Đã duyệt')).toBeTruthy();
  });

  it.each(['success', 'warning', 'danger', 'neutral', 'info'] as const)(
    'applies distinct styling for variant %s',
    (variant) => {
      render(<StatusBadge variant={variant}>Label</StatusBadge>);
      const el = screen.getByText('Label');
      expect(el.className).toContain(variant === 'success' ? 'emerald' : variant === 'warning' ? 'amber' : variant === 'danger' ? 'red' : variant === 'neutral' ? 'slate' : 'indigo');
    },
  );
});
```

(Check this repo's real Vitest/Testing Library import conventions — e.g. whether `describe`/`it`/`expect` need explicit import or are globals, by reading an existing `apps/web/src/**/*.test.tsx` file — adapt the import line if it differs.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- status-badge`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 4: Implement `StatusBadge`**

```tsx
// apps/web/src/components/status-badge.tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils'; // shadcn's generated cn() helper — confirm exact path/name from Task 1's init output

const VARIANT_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
} as const;

export type StatusBadgeVariant = keyof typeof VARIANT_CLASSES;

export function StatusBadge({
  variant,
  children,
}: {
  variant: StatusBadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <Badge className={cn('font-semibold', VARIANT_CLASSES[variant])} variant="outline">
      {children}
    </Badge>
  );
}
```

(shadcn's `Badge` component's exact prop shape — whether it accepts `variant="outline"` out of the box, and whether `className` merges or overrides — depends on what Task 1's `add badge` generated. Read the real generated `badge.tsx` before finalizing this; adjust so `VARIANT_CLASSES` styling actually wins over any default badge background/border.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- status-badge`
Expected: PASS.

- [ ] **Step 6: Run full web suite + typecheck**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors.

- [ ] **Step 7: Commit**

```bash
cd apps/web && git add src/components/ui src/components/status-badge.tsx src/components/status-badge.test.tsx
git commit -m "feat(web): thêm component badge trạng thái dùng chung"
```

---

### Task 3: `DashboardSidebar` — extract and restyle the merchant/admin shell

**Files:**
- Create: `apps/web/src/components/dashboard-sidebar.tsx`
- Test: `apps/web/src/components/dashboard-sidebar.test.tsx`
- Modify: `apps/web/src/app/merchant/layout.tsx`, `apps/web/src/app/admin/layout.tsx`, `apps/web/src/components/logout-button.tsx`, `apps/web/src/app/layout.tsx`

**Interfaces:**
- Consumes: sidebar tokens from Task 1.
- Produces: `<DashboardSidebar label="Merchant" | "Admin" navItems={{ href: string; label: string }[]} />` — a shared component replacing the near-identical `<aside>` markup currently duplicated between `merchant/layout.tsx` and `admin/layout.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/dashboard-sidebar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardSidebar } from './dashboard-sidebar';

describe('DashboardSidebar', () => {
  it('renders the label and every nav item as a link to its href', () => {
    render(
      <DashboardSidebar
        label="Merchant"
        navItems={[
          { href: '/merchant', label: 'Tổng quan' },
          { href: '/merchant/venues', label: 'Cụm sân' },
        ]}
      />,
    );

    expect(screen.getByText('Merchant')).toBeTruthy();
    const overviewLink = screen.getByText('Tổng quan').closest('a');
    expect(overviewLink).toHaveAttribute('href', '/merchant');
    const venuesLink = screen.getByText('Cụm sân').closest('a');
    expect(venuesLink).toHaveAttribute('href', '/merchant/venues');
  });
});
```

(Check this repo's convention for testing a component that uses `next/link` inside a Server/Client boundary — an existing test for a page using `<Link>` shows whether a mock or a real render is used here; adapt if needed.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- dashboard-sidebar`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement `DashboardSidebar`**

```tsx
// apps/web/src/components/dashboard-sidebar.tsx
import Link from 'next/link';

export interface DashboardNavItem {
  href: string;
  label: string;
}

export function DashboardSidebar({
  label,
  navItems,
}: {
  label: string;
  navItems: DashboardNavItem[];
}) {
  return (
    <aside className="flex flex-col gap-1 bg-sidebar p-4 sm:w-56">
      <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-sidebar-muted">
        {label}
      </p>
      <div className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-active-bg hover:text-sidebar-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
```

(This deliberately does not add active-route highlighting — React Server Component layouts don't have easy access to the current pathname without converting to a client component or using `usePathname()`, and the spec doesn't require it. Skip it for this Foundation plan; it's a reasonable enhancement for the Web pages plan if wanted, not a gap here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- dashboard-sidebar`
Expected: PASS.

- [ ] **Step 5: Wire it into both layouts**

```tsx
// apps/web/src/app/merchant/layout.tsx — replace the <aside>...</aside> block with:
import { DashboardSidebar } from '@/components/dashboard-sidebar';
// (remove the now-unused NAV_ITEMS-adjacent <aside> JSX, keep the NAV_ITEMS const)

      <DashboardSidebar label="Merchant" navItems={NAV_ITEMS} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border bg-card p-4">
          <LogoutButton />
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
```

Apply the identical change to `apps/web/src/app/admin/layout.tsx` with `label="Admin"`.

- [ ] **Step 6: Restyle `LogoutButton` and the root `<body>`**

```tsx
// apps/web/src/components/logout-button.tsx
'use client';

import { logout } from '@/app/logout/actions';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm">
        Đăng xuất
      </Button>
    </form>
  );
}
```

(Confirm shadcn's real `Button` prop names — `variant`/`size` are its documented API, but verify against the actual generated `apps/web/src/components/ui/button.tsx` from Task 1 rather than assuming.)

```tsx
// apps/web/src/app/layout.tsx — body className
      <body className="min-h-full flex flex-col bg-background text-foreground antialiased">{children}</body>
```

(`antialiased` moves from the outer `<html>` className if it's there, or is added here — check the current file; don't duplicate it in both places.)

- [ ] **Step 7: Run full web suite + typecheck**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors. If any existing test for `merchant/layout.tsx`/`admin/layout.tsx` asserts on the old inline `<aside>` markup structure rather than behavior (link presence/href), that's a sign the test was over-specified — update it to assert through `DashboardSidebar`'s own behavior instead of deleting coverage.

- [ ] **Step 8: Manually verify in the browser**

Start the web dev server, log in as a merchant and as an admin, confirm both dashboards render the dark sidebar with correct nav items, links work, logout button works. Report what you observed.

- [ ] **Step 9: Commit**

```bash
cd apps/web && git add src/components/dashboard-sidebar.tsx src/components/dashboard-sidebar.test.tsx src/app/merchant/layout.tsx src/app/admin/layout.tsx src/components/logout-button.tsx src/app/layout.tsx
git commit -m "feat(web): thêm sidebar dùng chung, áp dụng token mới cho khung merchant/admin"
```

---

### Task 4: Migrate the login page to shadcn components

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/login/login-form.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Label` from Task 1/2.
- Produces: nothing new consumed by later tasks — this is a proving-ground page for the Web pages plan to follow the same pattern.

- [ ] **Step 1: Migrate `login-form.tsx`**

```tsx
// apps/web/src/app/login/login-form.tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, type LoginActionState } from './actions';

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </Button>
    </form>
  );
}
```

(The `id`/`name`/`required`/`autoComplete`/`type` attributes must all carry over exactly — the Server Action reads `formData.get('email')`/`formData.get('password')` by `name`, and `role="alert"` on the error `<p>` is likely asserted by an existing test — check `apps/web/src/app/login/login-form.test.tsx` if one exists and keep every selector it uses working.)

- [ ] **Step 2: Migrate `page.tsx`**

```tsx
// apps/web/src/app/login/page.tsx
import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-extrabold text-foreground">Đăng nhập SportSpace</h1>
      <LoginForm />
      <Link href="/forgot-password" className="text-sm text-primary hover:underline">
        Quên mật khẩu?
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Run existing tests + typecheck**

Run: `cd apps/web && pnpm test -- login && pnpm exec tsc --noEmit`
Expected: pass, zero errors. If `login-form.test.tsx` breaks, it's almost certainly because it queried by a Tailwind class or raw `<input>` role assumption that shadcn's `Input` changes — fix the test to query by label/role/name instead, matching how this project's other action tests already query forms (check `apps/web/src/app/forgot-password/forgot-password-form.test.tsx` for the established pattern).

- [ ] **Step 4: Manually verify in the browser**

Load `/login`, confirm the form renders with the new styling, submitting valid/invalid credentials still works.

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/app/login
git commit -m "feat(web): áp dụng component shadcn cho trang đăng nhập"
```

---

### Task 5: Mobile theme module

**Files:**
- Create: `apps/mobile/src/theme/colors.ts`, `spacing.ts`, `radius.ts`, `typography.ts`, `statusColors.ts`, `useTheme.ts`, `index.ts`
- Test: `apps/mobile/src/theme/__tests__/useTheme.test.ts`

**Interfaces:**
- Produces: `useTheme(): { colors: ThemeColors; statusColors: Record<StatusVariant, { bg: string; text: string }>; spacing: typeof spacing; radius: typeof radius; typography: typeof typography; scheme: 'light' | 'dark' }` — every mobile component/screen task after this one consumes it via `import { useTheme } from '../../theme'` (adjust relative depth per file location).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/theme/__tests__/useTheme.test.ts
import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { useTheme } from '../useTheme';

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useColorScheme: jest.fn(),
}));

describe('useTheme', () => {
  it('returns light colors when the OS scheme is light', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.colors.background).toBe('#f8fafc');
    expect(result.current.scheme).toBe('light');
  });

  it('returns dark colors when the OS scheme is dark', () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.colors.background).toBe('#1e293b');
    expect(result.current.scheme).toBe('dark');
  });

  it('falls back to light when the OS scheme is null (unknown)', () => {
    (useColorScheme as jest.Mock).mockReturnValue(null);
    const { result } = renderHook(() => useTheme());
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors.background).toBe('#f8fafc');
  });
});
```

(Check this repo's existing convention for mocking `react-native`'s built-in hooks — if another test file already mocks `useColorScheme` or a similar RN hook, mirror its exact mock style instead of the above.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- useTheme`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement the theme module**

```typescript
// apps/mobile/src/theme/colors.ts
export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  danger: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarMuted: string;
}

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  foreground: '#0f172a',
  card: '#ffffff',
  cardForeground: '#0f172a',
  border: '#e2e8f0',
  mutedForeground: '#64748b',
  primary: '#4f46e5',
  primaryForeground: '#ffffff',
  danger: '#dc2626',
  sidebar: '#0f172a',
  sidebarForeground: '#f1f5f9',
  sidebarMuted: '#94a3b8',
};

export const darkColors: ThemeColors = {
  background: '#1e293b',
  foreground: '#f1f5f9',
  card: '#0f172a',
  cardForeground: '#f1f5f9',
  border: '#334155',
  mutedForeground: '#94a3b8',
  primary: '#6366f1',
  primaryForeground: '#ffffff',
  danger: '#f87171',
  sidebar: '#0f172a',
  sidebarForeground: '#f1f5f9',
  sidebarMuted: '#94a3b8',
};
```

```typescript
// apps/mobile/src/theme/spacing.ts
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
```

```typescript
// apps/mobile/src/theme/radius.ts
export const radius = { sm: 6, md: 8, pill: 999 } as const;
```

```typescript
// apps/mobile/src/theme/typography.ts
import type { TextStyle } from 'react-native';

export const typography: Record<'title' | 'heading' | 'body' | 'caption', TextStyle> = {
  title: { fontSize: 24, fontWeight: '800' },
  heading: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
};
```

```typescript
// apps/mobile/src/theme/statusColors.ts
export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface StatusColorPair {
  bg: string;
  text: string;
}

export const lightStatusColors: Record<StatusVariant, StatusColorPair> = {
  success: { bg: '#ecfdf5', text: '#047857' },
  warning: { bg: '#fffbeb', text: '#b45309' },
  danger: { bg: '#fef2f2', text: '#b91c1c' },
  neutral: { bg: '#f1f5f9', text: '#475569' },
  info: { bg: '#eef2ff', text: '#4338ca' },
};

export const darkStatusColors: Record<StatusVariant, StatusColorPair> = {
  success: { bg: '#022c22', text: '#6ee7b7' },
  warning: { bg: '#451a03', text: '#fcd34d' },
  danger: { bg: '#450a0a', text: '#fca5a5' },
  neutral: { bg: '#1e293b', text: '#cbd5e1' },
  info: { bg: '#1e1b4b', text: '#c7d2fe' },
};
```

```typescript
// apps/mobile/src/theme/useTheme.ts
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './colors';
import { darkStatusColors, lightStatusColors, type StatusColorPair, type StatusVariant } from './statusColors';
import { radius } from './radius';
import { spacing } from './spacing';
import { typography } from './typography';

export interface Theme {
  colors: ThemeColors;
  statusColors: Record<StatusVariant, StatusColorPair>;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  scheme: 'light' | 'dark';
}

export function useTheme(): Theme {
  const osScheme = useColorScheme();
  const scheme: 'light' | 'dark' = osScheme === 'dark' ? 'dark' : 'light';
  return {
    colors: scheme === 'dark' ? darkColors : lightColors,
    statusColors: scheme === 'dark' ? darkStatusColors : lightStatusColors,
    spacing,
    radius,
    typography,
    scheme,
  };
}
```

```typescript
// apps/mobile/src/theme/index.ts
export * from './colors';
export * from './spacing';
export * from './radius';
export * from './typography';
export * from './statusColors';
export * from './useTheme';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && pnpm test -- useTheme`
Expected: PASS.

- [ ] **Step 5: Run full mobile suite + typecheck**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/theme
git commit -m "feat(mobile): thêm module theme dùng chung (màu sắc, khoảng cách, kiểu chữ)"
```

---

### Task 6: `Button`, `Card`, `StatusPill` primitives

**Files:**
- Create: `apps/mobile/src/components/Button.tsx`, `Card.tsx`, `StatusPill.tsx`
- Test: `apps/mobile/src/components/__tests__/Button.test.tsx`, `Card.test.tsx`, `StatusPill.test.tsx`

**Interfaces:**
- Consumes: `useTheme` from Task 5.
- Produces:
  - `<Button testID? onPress disabled? loading? variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'>{children}</Button>` (`variant` defaults to `'primary'`; `loading` swaps children for an `ActivityIndicator` and implies `disabled`).
  - `<Card testID? onPress? style?>{children}</Card>` (renders as `Pressable` if `onPress` given, else `View`).
  - `<StatusPill testID? variant: StatusVariant>{children}</StatusPill>`.

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/mobile/src/components/__tests__/Button.test.tsx
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('fires onPress when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<Button testID="my-button" onPress={onPress}>Lưu</Button>);

    await user.press(screen.getByTestId('my-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<Button testID="my-button" onPress={onPress} disabled>Lưu</Button>);

    await user.press(screen.getByTestId('my-button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label when loading, and is not pressable', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(<Button testID="my-button" onPress={onPress} loading>Lưu</Button>);

    expect(screen.queryByText('Lưu')).toBeNull();
    await user.press(screen.getByTestId('my-button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

```tsx
// apps/mobile/src/components/__tests__/Card.test.tsx
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><Text>Nội dung</Text></Card>);
    expect(screen.getByText('Nội dung')).toBeTruthy();
  });

  it('fires onPress when provided', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    render(
      <Card testID="my-card" onPress={onPress}>
        <Text>Nội dung</Text>
      </Card>,
    );

    await user.press(screen.getByTestId('my-card'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

```tsx
// apps/mobile/src/components/__tests__/StatusPill.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it.each(['success', 'warning', 'danger', 'neutral', 'info'] as const)(
    'renders its label for variant %s',
    (variant) => {
      render(<StatusPill variant={variant}>Đã xác nhận</StatusPill>);
      expect(screen.getByText('Đã xác nhận')).toBeTruthy();
    },
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && pnpm test -- Button Card StatusPill`
Expected: FAIL — none of the three files exist yet.

- [ ] **Step 3: Implement the three primitives**

```tsx
// apps/mobile/src/components/Button.tsx
import React from 'react';
import { ActivityIndicator, Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface ButtonProps {
  testID?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  testID,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  children,
  style,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'destructive'
        ? colors.danger
        : variant === 'secondary'
          ? colors.card
          : 'transparent';
  const textColor =
    variant === 'primary' || variant === 'destructive' ? colors.primaryForeground : colors.primary;
  const borderColor = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '600', fontSize: 14 },
});
```

```tsx
// apps/mobile/src/components/Card.tsx
import React from 'react';
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface CardProps {
  testID?: string;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ testID, onPress, children, style }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const cardStyle = [
    styles.base,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={cardStyle}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, gap: 4 },
});
```

```tsx
// apps/mobile/src/components/StatusPill.tsx
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { StatusVariant } from '../theme';

export interface StatusPillProps {
  testID?: string;
  variant: StatusVariant;
  children: React.ReactNode;
}

export function StatusPill({ testID, variant, children }: StatusPillProps) {
  const { statusColors, radius, spacing } = useTheme();
  const { bg, text } = statusColors[variant];

  return (
    <View
      testID={testID}
      style={[
        styles.base,
        { backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
      ]}
    >
      <Text style={[styles.label, { color: text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && pnpm test -- Button Card StatusPill`
Expected: PASS.

- [ ] **Step 5: Run full mobile suite + typecheck**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/components/Button.tsx src/components/Card.tsx src/components/StatusPill.tsx src/components/__tests__
git commit -m "feat(mobile): thêm component dùng chung Button, Card, StatusPill"
```

---

### Task 7: `ScreenHeader` primitive

**Files:**
- Create: `apps/mobile/src/components/ScreenHeader.tsx`
- Test: `apps/mobile/src/components/__tests__/ScreenHeader.test.tsx`

**Interfaces:**
- Consumes: `useTheme` from Task 5.
- Produces: `<ScreenHeader title subtitle? />` — the dark band component used on the app's tab-root screens (this plan applies it to one; the Mobile screens plan applies it to the rest).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/components/__tests__/ScreenHeader.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ScreenHeader } from '../ScreenHeader';

describe('ScreenHeader', () => {
  it('renders the title', () => {
    render(<ScreenHeader title="Tìm sân" />);
    expect(screen.getByText('Tìm sân')).toBeTruthy();
  });

  it('renders the subtitle when given', () => {
    render(<ScreenHeader title="Tìm sân" subtitle="Quận 7, TP.HCM" />);
    expect(screen.getByText('Quận 7, TP.HCM')).toBeTruthy();
  });

  it('omits the subtitle line when not given', () => {
    render(<ScreenHeader title="Tìm sân" />);
    expect(screen.queryByTestId('screen-header-subtitle')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- ScreenHeader`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement `ScreenHeader`**

```tsx
// apps/mobile/src/components/ScreenHeader.tsx
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.sidebar, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
      ]}
    >
      <Text style={[styles.title, { color: colors.sidebarForeground }]}>{title}</Text>
      {subtitle ? (
        <Text testID="screen-header-subtitle" style={[styles.subtitle, { color: colors.sidebarMuted }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && pnpm test -- ScreenHeader`
Expected: PASS.

- [ ] **Step 5: Run full mobile suite + typecheck**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/components/ScreenHeader.tsx src/components/__tests__/ScreenHeader.test.tsx
git commit -m "feat(mobile): thêm component ScreenHeader (dải header tối)"
```

---

### Task 8: Migrate the auth screens (Login, Register, ForgotPassword)

**Files:**
- Modify: `apps/mobile/src/screens/auth/LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Button` from Tasks 5-6.
- Produces: nothing new consumed by later tasks — proving ground for the Mobile screens plan's migration pattern.

- [ ] **Step 1: Migrate `LoginScreen.tsx`**

Every `testID` below is unchanged from the current file — only styling and the button implementation change.

```tsx
// apps/mobile/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { useTheme } from '../../theme';
import { Button } from '../../components/Button';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors, spacing, radius, typography } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch {
      setError('Sai email hoặc mật khẩu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]}
      testID="login-screen"
    >
      <Text style={[typography.title, { color: colors.foreground, marginBottom: spacing.md }]}>Đăng nhập</Text>
      <TextInput
        testID="login-email"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Email"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        testID="login-password"
        style={[styles.input, { borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.foreground }]}
        placeholder="Mật khẩu"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? (
        <Text testID="login-error" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button testID="login-submit" onPress={() => void handleSubmit()} loading={isSubmitting}>
        Đăng nhập
      </Button>
      <Pressable testID="login-go-register" onPress={() => navigation.navigate('Register')}>
        <Text style={[styles.link, { color: colors.primary }]}>Chưa có tài khoản? Đăng ký</Text>
      </Pressable>
      <Pressable testID="login-go-forgot-password" onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={[styles.link, { color: colors.primary }]}>Quên mật khẩu?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  input: { borderWidth: 1 },
  link: { textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Run the existing `LoginScreen` test file**

Run: `cd apps/mobile && pnpm test -- LoginScreen`
Expected: PASS unchanged — every `testID` this test queries by is still present. If it fails, read the failure carefully: it means the test asserted something beyond `testID` presence (e.g. exact text of the loading state) that this migration changed — reconcile by matching the test's actual expectation, not by loosening the test.

- [ ] **Step 3: Migrate `RegisterScreen.tsx` and `ForgotPasswordScreen.tsx` the same way**

Apply the identical pattern (theme tokens for colors/spacing/radius/typography, `Button` primitive replacing the hand-rolled `Pressable`+`ActivityIndicator`, every existing `testID` preserved) to both files. `RegisterScreen.tsx` has 4 inputs (`register-fullName`, `register-email`, `register-password`, `register-phone`) plus `register-error`/`register-submit`/`register-go-login`. `ForgotPasswordScreen.tsx` has its own success-state branch (`forgot-password-success`) — read the real current file (already covered earlier in this project's history) before migrating, don't guess its exact current structure.

- [ ] **Step 4: Run the existing test files for both**

Run: `cd apps/mobile && pnpm test -- RegisterScreen ForgotPasswordScreen`
Expected: PASS unchanged.

- [ ] **Step 5: Run full mobile suite + typecheck**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors.

- [ ] **Step 6: Manually verify in the simulator/device**

Run the mobile app, walk through login, register, and forgot-password screens, confirm they render with the new palette and the primary button uses the indigo accent, all existing behavior (validation errors, navigation between screens) still works.

- [ ] **Step 7: Commit**

```bash
cd apps/mobile && git add src/screens/auth
git commit -m "feat(mobile): áp dụng theme và component Button cho luồng xác thực"
```

---

### Task 9: `VenueListScreen` + tab bar + default stack header colors

**Files:**
- Modify: `apps/mobile/src/screens/venues/VenueListScreen.tsx`, `apps/mobile/src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Card`, `StatusPill`, `ScreenHeader`, `Button` from Tasks 5-7.
- Produces: nothing new consumed by later tasks — proving ground for the Mobile screens plan.

- [ ] **Step 1: Migrate `VenueListScreen.tsx`**

Add `ScreenHeader` at the top, restyle the search bar and venue cards with theme tokens, swap each venue card's `Pressable` for `Card`. Every existing `testID` (`venue-list-screen`, `venue-sport-input`, `venue-search-submit`, `venue-location-banner`, `venue-location-retry`, `venue-list-loading`, `venue-list-error`, `venue-list-retry`, `venue-list-empty`, `venue-list`, `venue-item-${id}`) stays exactly as-is — only wrap the existing `View testID="venue-list-screen"` root's children with a `ScreenHeader` as the first child, and replace hardcoded style values (`#1d4ed8`, `#ccc`, `#eee`, `#555`, `#dc2626`, `#92400e`) with the matching theme token. Read the real current file (shown earlier in this project's history) as the base to edit, not a re-write from scratch.

```tsx
// apps/mobile/src/screens/venues/VenueListScreen.tsx — representative excerpt of the change
  const { colors, spacing, radius } = useTheme();
  // ...
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="venue-list-screen">
      <ScreenHeader title="Tìm sân" />
      <View style={[styles.searchRow, { padding: spacing.lg }]}>
        <TextInput
          testID="venue-sport-input"
          style={[styles.input, { flex: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, color: colors.foreground }]}
          placeholder="Lọc theo bộ môn (vd: bóng đá)"
          placeholderTextColor={colors.mutedForeground}
          value={sportInput}
          onChangeText={setSportInput}
          onSubmitEditing={() => setAppliedSport(sportInput.trim())}
        />
        <Button testID="venue-search-submit" onPress={() => setAppliedSport(sportInput.trim())} variant="secondary">
          Tìm
        </Button>
      </View>
      {/* ...rest of the screen: banner/loading/error/empty states get colors.danger / colors.mutedForeground / colors.primary
          in place of their current hardcoded hex; the FlatList's renderItem wraps each item in
          <Card testID={`venue-item-${item.venue.id}`} onPress={() => navigation.navigate(...)}> instead of the current
          hand-styled Pressable, keeping the same onPress navigation call. */}
```

(This excerpt shows the pattern, not the complete file — apply it consistently through every remaining hardcoded style value in the file, preserving all existing logic/handlers untouched.)

- [ ] **Step 2: Restyle the tab bar and default stack headers in `RootNavigator.tsx`**

```tsx
// apps/mobile/src/navigation/RootNavigator.tsx
import { useTheme } from '../theme';
// ... inside RootNavigator(), before the return:
  const { colors } = useTheme();

// AppTabs() needs access to theme too — either lift useTheme() into AppTabs itself, or pass colors down;
// simplest is calling useTheme() again inside AppTabs (cheap hook, no prop drilling needed):
function AppTabs() {
  const { colors } = useTheme();
  return (
    <RootTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      {/* ...unchanged screens */}
    </RootTab.Navigator>
  );
}
```

For the nested stack navigators (`VenuesNavigator`, `MyBookingsNavigator`, `MatchesNavigator`) that currently use React Navigation's unstyled default header, add matching `screenOptions` to each `*.Navigator`:

```tsx
function VenuesNavigator() {
  const { colors } = useTheme();
  return (
    <VenuesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
      }}
    >
      {/* ...unchanged screens */}
    </VenuesStack.Navigator>
  );
}
```

Apply the identical `screenOptions` addition to `MyBookingsNavigator` and `MatchesNavigator`.

- [ ] **Step 3: Run the existing `VenueListScreen` test file**

Run: `cd apps/mobile && pnpm test -- VenueListScreen`
Expected: PASS unchanged.

- [ ] **Step 4: Run full mobile suite + typecheck**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero errors.

- [ ] **Step 5: Manually verify in the simulator/device**

Run the mobile app, log in, confirm the "Tìm sân" tab shows the dark `ScreenHeader` band, the bottom tab bar's active tab is indigo, and navigating into a venue detail shows a restyled (not default-blue) native header.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/screens/venues/VenueListScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat(mobile): áp dụng ScreenHeader và theme cho màn hình tìm sân, thanh tab và header điều hướng"
```
