# UI Design System — Mobile Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 10 remaining `apps/mobile` screens off hardcoded hex colors onto the theme module, then — as the final act of the whole three-plan initiative — switch the app from `userInterfaceStyle: "light"` to `"automatic"` so dark mode actually runs on a device for the first time.

**Architecture:** Pure restyling, screen by screen, using the primitives the Foundation plan already merged (`useTheme`, `Button`, `Card`, `StatusPill`, `ScreenHeader` in `apps/mobile/src/`). Task 1 adds the one primitive Foundation deliberately deferred — a themed `Input` — because Foundation's review found the 3 auth screens each hand-rolling identical `TextInput` styling, and 4 more screens here would copy it again. The last task flips the dark-mode switch, which is only safe once every screen is theme-aware.

**Tech Stack:** React Native / Expo SDK 57, `@testing-library/react-native` v14 — all already installed. **No new dependencies.**

## Global Constraints

- **Restyle only.** Do not change navigation, API calls, state logic, validation, or conditional rendering. If a screen needs a real behavior fix, stop and report it rather than folding it into a restyle commit.
- **Preserve every `testID` exactly.** All 13 screens already have tests that query by `testID`; a renamed one breaks them loudly, a *dropped* one can break them subtly. Never remove or rename one.
- **Preserve all Vietnamese copy exactly** — no rewording while restyling.
- **Zero hardcoded hex** in any migrated screen when done. The only files permitted to contain hex literals are `apps/mobile/src/theme/*` (where the palette is defined) and `src/components/__tests__/{StatusPill,ScreenHeader}.test.tsx` (Foundation's deliberate color-contract assertions — leave them alone).
- `useTheme()` returns a fresh object each render. Put **`theme.scheme`** (a stable string) in `useMemo`/`useEffect`/`useCallback` dependency arrays, never `theme` or `theme.colors`, or you defeat memoization on every render.
- Two different reds exist on purpose: `colors.danger` for destructive actions/error text, `statusColors.danger` for `StatusPill variant="danger"`. Never cross them.
- `pnpm test` and `pnpm exec tsc --noEmit` must both be clean in `apps/mobile` at the end of **every** task.
- Vietnamese-only git commit messages; zero AI/Claude/Co-Authored-By mentions in any commit.

## Substitution Table

| Old (hardcoded) | New |
|---|---|
| `backgroundColor: '#1d4ed8'` + `Pressable` + `ActivityIndicator`/`Text` submit block | `<Button testID=… onPress=… loading=…>` |
| `color: '#dc2626'` (error text) | `colors.danger` |
| `borderColor: '#ccc'` (input border) | `<Input>` from Task 1 |
| `borderBottomColor: '#eee'` / `borderColor: '#eee'` (dividers, card edges) | `colors.border` |
| `color: '#555'` / `'#777'` / `'#999'` (secondary text) | `colors.mutedForeground` |
| `color: '#1d4ed8'` (link/accent text) | `colors.primary` |
| `backgroundColor: '#fff'` (surfaces) | `colors.card` |
| `color: '#92400e'` (warning text) | `statusColors.warning.text` |
| card-ish `View`/`Pressable` with border + padding | `<Card>` / `<Card onPress=…>` |
| status rendered as plain `<Text>` | `<StatusPill variant=…>` |
| `fontSize`/`fontWeight` literals | `typography.title` / `.heading` / `.body` / `.caption` where one matches; keep a literal only when no token fits, and say so in the report |

`StatusPill` variant mapping (matches web's `StatusBadge` exactly): `CONFIRMED`/`ACCEPTED`/`PAID` → `success`; `PENDING`/`REQUESTED`/`OPEN` → `warning`; `CANCELLED`/`REJECTED`/`FAILED` → `danger`; `REFUNDED`/closed/inactive → `neutral`; sport or category tags → `info`.

---

## File Structure

**Task 1 — new:** `apps/mobile/src/components/Input.tsx` (+ `__tests__/Input.test.tsx`); **modified:** the 3 auth screens (`LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`) retro-fitted onto it, plus `VenueListScreen`'s search field.

**Tasks 2-5 — modified only** (each screen keeps its existing test file; add cases only where the task says so):
- **Task 2** — `screens/bookings/MyBookingsScreen.tsx`, `screens/AccountScreen.tsx`
- **Task 3** — `screens/venues/VenueDetailScreen.tsx`, `screens/venues/CourtSlotsScreen.tsx`
- **Task 4** — `screens/venues/BookingConfirmScreen.tsx`, `screens/bookings/WriteReviewScreen.tsx`, `screens/bookings/CreateMatchScreen.tsx`
- **Task 5** — `screens/matches/MatchListScreen.tsx`, `screens/matches/MatchDetailScreen.tsx`, `screens/notifications/NotificationsScreen.tsx`

**Task 6 — modified:** `apps/mobile/app.json`, `apps/mobile/src/components/ScreenHeader.tsx` (+ its test), `apps/mobile/src/components/Button.tsx`.

---

### Task 1: Themed `Input` primitive + retro-fit onto the 4 screens that already have text fields

**Files:**
- Create: `apps/mobile/src/components/Input.tsx`
- Test: `apps/mobile/src/components/__tests__/Input.test.tsx`
- Modify: `apps/mobile/src/screens/auth/{LoginScreen,RegisterScreen,ForgotPasswordScreen}.tsx`, `apps/mobile/src/screens/venues/VenueListScreen.tsx`

**Interfaces:**
- Consumes: `useTheme` from Foundation.
- Produces: `<Input testID? value onChangeText placeholder? … />` — accepts and forwards **all** standard `TextInputProps` (`secureTextEntry`, `keyboardType`, `autoCapitalize`, `multiline`, `onSubmitEditing`, …), applies themed border/radius/padding/text color, and sets `placeholderTextColor` from the theme. Tasks 3-5 use this for every remaining text field.

This is Foundation's deferred carry-forward: its review found the 3 auth screens each repeating an identical inline `{ borderWidth: 1, borderColor, borderRadius, padding, color }` object, and warned that migrating 10 more screens the same way would turn a one-file change into a thirteen-file change.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/components/__tests__/Input.test.tsx
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Input } from '../Input';

describe('Input', () => {
  it('hiển thị giá trị và gọi onChangeText khi gõ', async () => {
    const onChangeText = jest.fn();
    const user = userEvent.setup();
    await render(<Input testID="my-input" value="" onChangeText={onChangeText} placeholder="Email" />);

    await user.type(screen.getByTestId('my-input'), 'a');

    expect(onChangeText).toHaveBeenCalled();
  });

  it('chuyển tiếp các prop TextInput tiêu chuẩn xuống phần tử thật', async () => {
    await render(
      <Input
        testID="my-input"
        value=""
        onChangeText={() => {}}
        secureTextEntry
        keyboardType="email-address"
        autoCapitalize="none"
      />,
    );

    const input = screen.getByTestId('my-input');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.autoCapitalize).toBe('none');
  });
});
```

(`@testing-library/react-native` v14 returns a Promise from `render` — the `await` is required. Foundation's Task 6 confirmed this empirically; `apps/mobile/src/components/__tests__/Button.test.tsx` is the established example to match.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- Input`
Expected: FAIL — the component doesn't exist.

- [ ] **Step 3: Implement `Input`**

```tsx
// apps/mobile/src/components/Input.tsx
import React from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';

export type InputProps = TextInputProps;

export function Input({ style, ...props }: InputProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[
        styles.base,
        {
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.md,
          color: colors.foreground,
          backgroundColor: colors.card,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
});
```

Note the prop order: `placeholderTextColor` comes **before** `{...props}` so a caller can override it, while `style` is applied last so caller styles win. Spreading `{...props}` before `style` also means every standard `TextInputProps` reaches the real `TextInput` — that is what Step 1's second test locks down.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && pnpm test -- Input`
Expected: PASS (2 tests).

- [ ] **Step 5: Retro-fit the 3 auth screens and `VenueListScreen`**

In each, replace the `<TextInput style={[styles.input, {...theme values}]} placeholderTextColor={...} …>` with `<Input …>`, deleting the now-unused `input` entry from that screen's `StyleSheet` and the inline theme object it needed. **Keep every `testID`, `placeholder`, `value`, `onChangeText`, `secureTextEntry`, `keyboardType`, `autoCapitalize`, and `onSubmitEditing` exactly as-is.** `VenueListScreen`'s search field additionally has `style={{ flex: 1 }}`-type layout sizing — pass that through `style`, which `Input` merges last.

- [ ] **Step 6: Run the full mobile suite**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: all pass, zero errors. The 4 touched screens' existing tests must pass **unmodified** — they query by `testID` and by placeholder text, both preserved. If one fails, read it: that means a prop stopped reaching the real `TextInput`, which is a real bug in `Input`, not a reason to edit the test.

- [ ] **Step 7: Commit**

```bash
cd apps/mobile && git add src/components/Input.tsx src/components/__tests__/Input.test.tsx src/screens/auth src/screens/venues/VenueListScreen.tsx
git commit -m "feat(mobile): thêm component Input dùng chung và áp dụng cho các màn có ô nhập"
```

---

### Task 2: `MyBookingsScreen` + `AccountScreen`

**Files:**
- Modify: `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx`, `apps/mobile/src/screens/AccountScreen.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Card`, `StatusPill`, `Button`, `ScreenHeader` from Foundation.

These are the two **tab-root** screens in this task, so both get a `ScreenHeader`. `MyBookingsScreen` is also the screen whose `STATUS_LABEL` map Foundation cited as the canonical source for Vietnamese booking-status wording — the web app was matched to it, so **do not change those strings**.

> **⚠️ Duplicate-title trap — applies to every screen that gains a `ScreenHeader` (here and in Task 5).** `AccountScreen` currently renders its own `<Text style={styles.title}>Tài khoản</Text>`, and other tab roots may do the same. Adding `<ScreenHeader title="Tài khoản" />` **without deleting that inline title** shows the title twice. This exact bug shipped in Foundation Task 9 on `VenueListScreen` (native header + `ScreenHeader` both rendering "Tìm sân") and had to be fixed in a follow-up round. Before adding a `ScreenHeader` to any screen: check for an existing in-body title and remove it, and check `RootNavigator.tsx` to confirm that screen's navigator already has `headerShown: false` (the tab navigator's own header must not also be showing one).

- [ ] **Step 1: Migrate `MyBookingsScreen.tsx`**

- Add `<ScreenHeader title="Lịch của tôi" />` as the first child of the root `View` (matching how `VenueListScreen` does it — read that file for the exact pattern).
- Each booking row (`styles.card`) → `<Card>`. Keep `testID={`booking-item-${item.id}`}`.
- `styles.cardStatus` (currently `color: '#1d4ed8'`) → `<StatusPill>` using the existing `STATUS_LABEL[item.status]` text and the variant mapping in the Substitution Table (`CONFIRMED` → `success`, `PENDING` → `warning`, `CANCELLED` → `danger`).
- The three action buttons (`booking-create-match-*`, `booking-review-*`, `booking-cancel-*`) → `<Button>`: create-match and review use the default `primary`; cancel uses `variant="destructive"` and keeps its `disabled={cancellingId === item.id}` plus its "Đang huỷ..." label logic.
- Refund line, empty/loading/error states, and `RefreshControl` keep their structure; only colors change.
- **Do not touch** `fetchBookings`, `useFocusEffect`, `performCancel`, `confirmCancel`, or any `navigation.navigate` argument.

- [ ] **Step 2: Migrate `AccountScreen.tsx`**

Small screen (24 lines), fully quoted here since it is short:

- Add `<ScreenHeader title="Tài khoản" />` as the first child **and delete the existing `<Text style={styles.title}>Tài khoản</Text>`** plus its now-unused `title` style entry — see the duplicate-title warning above.
- `<Pressable testID="account-logout" style={styles.button}>` (currently `backgroundColor: '#dc2626'`) → `<Button testID="account-logout" variant="destructive" onPress={() => void logout()}>Đăng xuất</Button>`, dropping the `button`/`buttonText` style entries.
- The root `View` gains `backgroundColor: colors.background`; `Vai trò: {user?.role}` text gains `color: colors.foreground`.
- Note its container is `alignItems: 'center', justifyContent: 'center'` — with a `ScreenHeader` band on top, that centering now applies to the remaining content below the band. Keep the centering; just make sure the header sits above it rather than inside the centered column (header first, then a `flex: 1` centered content `View`).
- Keep `testID="account-screen"` and `testID="account-logout"` exactly.

- [ ] **Step 3: Run the full mobile suite**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: all pass. `MyBookingsScreen.test.tsx` asserts on `toHaveTextContent('Đã xác nhận')` — that text now lives inside `StatusPill`, which renders it as a `<Text>` child, so the assertion still holds. If it fails, check you did not drop the label rather than changing the test.

- [ ] **Step 4: Verify no hex remains**

Run: `cd apps/mobile && grep -n "#[0-9a-fA-F]\{3,6\}" src/screens/bookings/MyBookingsScreen.tsx src/screens/AccountScreen.tsx`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add src/screens/bookings/MyBookingsScreen.tsx src/screens/AccountScreen.tsx
git commit -m "feat(mobile): áp dụng hệ thống thiết kế cho màn lịch đặt sân và tài khoản"
```

---

### Task 3: `VenueDetailScreen` + `CourtSlotsScreen`

**Files:**
- Modify: `apps/mobile/src/screens/venues/VenueDetailScreen.tsx`, `apps/mobile/src/screens/venues/CourtSlotsScreen.tsx`

**Interfaces:**
- Consumes: `useTheme`, `Card`, `StatusPill` from Foundation.

Both are **stack children**, not tab roots — they keep React Navigation's native header (already themed in Foundation Task 9) and must **not** get a `ScreenHeader`.

- [ ] **Step 1: Migrate `VenueDetailScreen.tsx`**

Foundation already added this screen's image carousel; that code stays. Convert the court rows to `<Card onPress=…>` keeping `testID={`court-item-${item.id}`}` and the exact `navigation.navigate('CourtSlots', {...})` argument object; apply theme colors to the header block, rating row, review items, and empty/error states. The sport tag on each court is a good `<StatusPill variant="info">` candidate — apply it if the current markup shows the sport as a standalone label, otherwise leave the text as-is and note the decision.

- [ ] **Step 2: Migrate `CourtSlotsScreen.tsx`**

This screen renders the booking-slot grid whose availability comes from the backend. **The slot-state logic is load-bearing and must not change** — it reads `SlotDto.available` and nothing else (Foundation's court-status plan depends on that). Restyle only: available vs unavailable slot colors come from the theme (`colors.primary` / `colors.mutedForeground` / `colors.border`), and the realtime `useCourtSlotUpdates` subscription is untouched.

- [ ] **Step 3: Run the full mobile suite + verify no hex**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Run: `cd apps/mobile && grep -n "#[0-9a-fA-F]\{3,6\}" src/screens/venues/VenueDetailScreen.tsx src/screens/venues/CourtSlotsScreen.tsx`
Expected: tests pass, grep silent.

- [ ] **Step 4: Commit**

```bash
cd apps/mobile && git add src/screens/venues/VenueDetailScreen.tsx src/screens/venues/CourtSlotsScreen.tsx
git commit -m "feat(mobile): áp dụng hệ thống thiết kế cho màn chi tiết sân và chọn khung giờ"
```

---

### Task 4: The three form screens — `BookingConfirmScreen`, `WriteReviewScreen`, `CreateMatchScreen`

**Files:**
- Modify: `apps/mobile/src/screens/venues/BookingConfirmScreen.tsx`, `apps/mobile/src/screens/bookings/WriteReviewScreen.tsx`, `apps/mobile/src/screens/bookings/CreateMatchScreen.tsx`

**Interfaces:**
- Consumes: `Input` from Task 1; `useTheme`, `Button`, `Card`, `StatusPill` from Foundation.

`BookingConfirmScreen` (304 lines) is the largest and riskiest screen in this plan — it drives the whole payment flow. Read it fully before editing.

- [ ] **Step 1: Migrate `WriteReviewScreen.tsx`**

The simplest of the three; do it first to establish the pattern. Its comment field → `<Input multiline>` (keeping `testID="write-review-comment"`, the placeholder, and `minHeight: 80` via `style`); submit → `<Button testID="write-review-submit" loading={isSubmitting}>`; `errorText` → `colors.danger`.

**The star rating keeps its own colors** — `starActive: '#f59e0b'` and `starInactive: '#d1d5db'` are not in the theme. Use `statusColors.warning.text` for the active star (amber, semantically "attention") and `colors.border` for the inactive one. If those read wrong side by side, keep the literals and say so in the report rather than forcing a bad match — but do not leave them silently unmigrated.

- [ ] **Step 2: Migrate `CreateMatchScreen.tsx`**

Its numeric/text fields → `<Input>` with every `keyboardType` and `testID` preserved; submit → `<Button loading=…>`; error text → `colors.danger`.

- [ ] **Step 3: Migrate `BookingConfirmScreen.tsx`**

Restyle only. **Do not touch** `startVnpayCheckout`, `pollBookingUntilConfirmed`, the `status`/`paymentState` state machine, the 409-conflict branch, or the add-on-services selection logic. The payment-state messages (`payment-checkout-error` and friends) keep their `testID`s; their colors come from `colors.danger`. The booking summary block is a good `<Card>`; the services list rows are `<Card>` or plain themed rows depending on the current markup — read and match.

- [ ] **Step 4: Run the full mobile suite + verify no hex**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Run: `cd apps/mobile && grep -n "#[0-9a-fA-F]\{3,6\}" src/screens/venues/BookingConfirmScreen.tsx src/screens/bookings/WriteReviewScreen.tsx src/screens/bookings/CreateMatchScreen.tsx`
Expected: tests pass; grep silent **unless** you kept the star literals per Step 1, in which case exactly those two lines may remain and must be explained in the report.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add src/screens/venues/BookingConfirmScreen.tsx src/screens/bookings/WriteReviewScreen.tsx src/screens/bookings/CreateMatchScreen.tsx
git commit -m "feat(mobile): áp dụng hệ thống thiết kế cho các màn form đặt sân, đánh giá và tạo kèo"
```

---

### Task 5: `MatchListScreen`, `MatchDetailScreen`, `NotificationsScreen`

**Files:**
- Modify: `apps/mobile/src/screens/matches/MatchListScreen.tsx`, `apps/mobile/src/screens/matches/MatchDetailScreen.tsx`, `apps/mobile/src/screens/notifications/NotificationsScreen.tsx`

**Interfaces:**
- Consumes: `Input` from Task 1; `useTheme`, `Card`, `StatusPill`, `Button`, `ScreenHeader` from Foundation.

`MatchListScreen` and `NotificationsScreen` are **tab roots** → both get a `ScreenHeader`. `MatchDetailScreen` is a stack child → native header, **no** `ScreenHeader`.

This task completes the migration: after it, no screen outside `src/theme/` contains a hex literal.

- [ ] **Step 1: Migrate `MatchListScreen.tsx`**

Add `<ScreenHeader title="Tìm kèo" />`; filter field → `<Input>`; match rows → `<Card onPress=…>`; the slots-filled indicator and any open/closed state → `<StatusPill>` (`OPEN` → `warning`, closed/full → `neutral`).

- [ ] **Step 2: Migrate `MatchDetailScreen.tsx`**

Participant rows use the existing `PARTICIPANT_STATUS_LABEL` map — render each participant's status as `<StatusPill>` with `REQUESTED` → `warning`, `ACCEPTED` → `success`, `REJECTED` → `danger`, keeping the map's Vietnamese strings verbatim. Accept/reject controls → `<Button>` / `<Button variant="destructive">`. **Do not change** the `isFull` computation or the join/accept/reject API calls.

- [ ] **Step 3: Migrate `NotificationsScreen.tsx`**

Add `<ScreenHeader title="Thông báo" />`; notification rows → `<Card>`; unread indicator uses `colors.primary`; read/muted text uses `colors.mutedForeground`.

- [ ] **Step 4: Run the full mobile suite**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: all pass.

- [ ] **Step 5: Verify the whole app is clean — this is the migration completion criterion**

Run: `cd apps/mobile && grep -rn "#[0-9a-fA-F]\{3,6\}" src/screens src/navigation src/components --include="*.tsx" | grep -v "__tests__"`
Expected: **no output**, except any star-color literals explicitly kept and explained in Task 4.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/screens/matches src/screens/notifications
git commit -m "feat(mobile): áp dụng hệ thống thiết kế cho màn tìm kèo, chi tiết kèo và thông báo"
```

---

### Task 6: Turn dark mode on — the final act of the initiative

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/src/components/ScreenHeader.tsx`, `apps/mobile/src/components/__tests__/ScreenHeader.test.tsx`
- Modify: `apps/mobile/src/components/Button.tsx`

**Interfaces:**
- Consumes: every screen being theme-aware, which Tasks 1-5 just finished.
- Produces: an app that actually follows the OS light/dark setting.

Foundation's final review found `apps/mobile/app.json` pins `"userInterfaceStyle": "light"`, which forces `useColorScheme()` to always return `'light'` on a real device — meaning **the entire dark branch of the theme has never executed outside of tests**, which mock the hook and bypass the switch. Foundation deliberately left it pinned because 10 screens were still light-only hardcoded; flipping it then would have shipped a half-dark app. Those 10 screens are now migrated, so this is the moment.

- [ ] **Step 1: Close Foundation's two deferred component gaps first**

These are cheap and belong with the dark-mode work:

**(a) `ScreenHeader` safe-area regression test (Foundation's n-1).** Foundation fixed the notch collision with `useSafeAreaInsets()` but no test locks it — the jest mock returns `insets.top: 0`, so even an assertion would pass against a hardcoded `spacing.xl`. Add a test that injects a real inset and asserts the computed padding:

```tsx
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

it('cộng safe-area inset vào paddingTop thay vì dùng hằng số', async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 59, bottom: 0, left: 0, right: 0 }}>
      <ScreenHeader title="Tìm sân" />
    </SafeAreaInsetsContext.Provider>,
  );
  const header = screen.getByTestId('screen-header');
  expect(StyleSheet.flatten(header.props.style).paddingTop).toBe(59 + 12); // insets.top + spacing.md
});
```

Then mutation-check it: temporarily restore `paddingTop: spacing.xl`, confirm the test fails, restore.

**(b) `Button`'s `accessibilityState` is missing `busy` (Foundation's n-2).** It currently reports `{ disabled: isDisabled }`; while `loading` is true a screen reader says "dimmed" rather than "busy". Change to `{ disabled: isDisabled, busy: loading ?? false }`.

- [ ] **Step 2: Flip the switch**

```json
// apps/mobile/app.json
"userInterfaceStyle": "automatic",
```

- [ ] **Step 3: Run the full mobile suite**

Run: `cd apps/mobile && pnpm test && pnpm exec tsc --noEmit`
Expected: all pass. Tests mock `useColorScheme` directly, so they are unaffected by this config change — which is exactly why this bug survived Foundation undetected, and why Step 4 is mandatory rather than optional.

- [ ] **Step 4: Verify dark mode on a real simulator — mandatory, not optional**

This is the only step that can prove the change worked; no test can. Boot a simulator, start the app, and flip the OS appearance with:

```bash
xcrun simctl ui <device> appearance dark
xcrun simctl ui <device> appearance light
```

(This is an OS-level command and needs no Accessibility permission — Foundation's fix round established it works in this sandbox where UI scripting does not.)

Walk **every** tab (Tìm sân, Lịch của tôi, Tìm kèo, Thông báo, Tài khoản) plus at least one stack child (venue detail or booking confirm) in **both** appearances. Capture screenshots. Confirm specifically:
- Content backgrounds/text invert with the OS setting.
- `ScreenHeader` stays dark navy in **both** modes (it is theme-invariant chrome by design).
- No screen shows black-on-black or white-on-white — that is the failure mode a half-migrated screen would produce.

Report exactly what you observed per screen. If any screen is unreadable in dark mode, that is a real defect: fix it before committing.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add app.json src/components/ScreenHeader.tsx src/components/__tests__/ScreenHeader.test.tsx src/components/Button.tsx
git commit -m "feat(mobile): bật dark mode tự động theo hệ điều hành, bổ sung test safe-area và trạng thái busy"
```
