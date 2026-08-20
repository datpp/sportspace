# Forgot Password (FR-P01) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real, email-delivered password reset flow — request a reset link by email, click it, set a new password — across backend, web, and mobile.

**Architecture:** A new `MailModule`/`MailService` wraps `nodemailer` over SMTP, configured entirely from env vars and gracefully no-op when unconfigured (mirrors `FcmService`'s pattern exactly). `User` gains a hashed reset-token + expiry pair (never the plaintext token, matching `passwordHash`'s existing principle). `AuthController` gains two new endpoints; the reset link always points at the web app, even for mobile-initiated requests, since this codebase has no deep-linking setup.

**Tech Stack:** NestJS + TypeORM (backend), Next.js App Router (web), React Native (mobile), `nodemailer` (new dependency).

## Global Constraints

- TypeScript strict; camelCase vars/functions, PascalCase classes/types.
- Vietnamese git commit messages, ZERO AI/Claude/Co-Authored-By attribution ever (hard standing project rule).
- No hand-written DB migrations — generate via `pnpm run migration:generate` from `apps/backend`.
- TDD: write the failing test before the implementation.
- Consult Context7 before writing framework-specific code you're not certain of (already done for `nodemailer`'s `createTransport`/`sendMail` API in this plan's research — the exact code below reflects that).
- `POST /auth/forgot-password` always returns 200 regardless of whether the email exists (prevents user enumeration).
- The raw reset token is never stored — only its hash.
- No rate-limiting beyond what already exists globally, no "resend" cooldown UI — explicitly out of scope.
- No mobile deep-linking — the reset link always opens in a browser, even from a mobile-initiated request.

---

## File Structure

**Backend — new:**
- `apps/backend/src/mail/mail.module.ts`
- `apps/backend/src/mail/mail.service.ts` (+ `.spec.ts`)
- `apps/backend/src/auth/dto/forgot-password.dto.ts`
- `apps/backend/src/auth/dto/reset-password.dto.ts`
- `apps/backend/src/database/migrations/*-AddPasswordResetToUsers.ts` (generated)

**Backend — modified:**
- `apps/backend/.env.example`
- `apps/backend/src/user/entities/user.entity.ts`
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/auth/auth.controller.ts` (+ `.spec.ts`)
- `apps/backend/src/auth/auth.service.ts` (+ `.spec.ts`)
- `apps/backend/test/auth.e2e-spec.ts`

**Web — new:**
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/forgot-password/forgot-password-form.tsx` (+ `.test.tsx`)
- `apps/web/src/app/forgot-password/actions.ts` (+ `.test.ts`)
- `apps/web/src/app/reset-password/page.tsx`
- `apps/web/src/app/reset-password/reset-password-form.tsx` (+ `.test.tsx`)
- `apps/web/src/app/reset-password/actions.ts` (+ `.test.ts`)

**Web — modified:**
- `apps/web/src/app/login/page.tsx`

**Mobile — new:**
- `apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx`
- `apps/mobile/src/screens/auth/__tests__/ForgotPasswordScreen.test.tsx`

**Mobile — modified:**
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/screens/auth/LoginScreen.tsx`

---

### Task 1: `MailModule`/`MailService` (nodemailer SMTP wrapper)

**Files:**
- Create: `apps/backend/src/mail/mail.module.ts`
- Create: `apps/backend/src/mail/mail.service.ts`
- Test: `apps/backend/src/mail/mail.service.spec.ts`
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Produces: `MailService.sendPasswordResetEmail(to: string, resetLink: string): Promise<void>`.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/backend && pnpm add nodemailer && pnpm add -D @types/nodemailer`
Expected: both added to `package.json`.

- [ ] **Step 2: Add SMTP env vars**

```bash
# apps/backend/.env.example — add after the FCM section
# Email đặt lại mật khẩu — SMTP tổng quát, có thể trỏ vào Gmail SMTP, Mailtrap,
# SendGrid SMTP relay, hoặc bất kỳ dịch vụ nào khác. Bỏ trống SMTP_HOST khi dev
# local: email sẽ được log ra console thay vì gửi thật, không chặn luồng.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@sportspace.dev
WEB_URL=http://localhost:3001
```

- [ ] **Step 3: Write the failing unit test**

```typescript
// apps/backend/src/mail/mail.service.spec.ts
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('does not throw and logs a warning when SMTP_HOST is not configured', async () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const service = new MailService(config);

    await expect(
      service.sendPasswordResetEmail('user@example.com', 'http://x/reset?token=abc'),
    ).resolves.toBeUndefined();
  });

  it('calls transporter.sendMail with the reset link in the body when configured', async () => {
    const values: Record<string, string> = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASSWORD: 'pass',
      SMTP_FROM: 'noreply@sportspace.dev',
    };
    const config = {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
    const service = new MailService(config);
    const sendMailSpy = jest
      .spyOn(
        (service as unknown as { transporter: { sendMail: (...args: unknown[]) => Promise<unknown> } })
          .transporter,
        'sendMail',
      )
      .mockResolvedValue({ messageId: 'x' });

    await service.sendPasswordResetEmail('user@example.com', 'http://x/reset?token=abc');

    expect(sendMailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        from: 'noreply@sportspace.dev',
      }),
    );
    const call = sendMailSpy.mock.calls[0][0] as { html: string; text: string };
    expect(call.html).toContain('http://x/reset?token=abc');
    expect(call.text).toContain('http://x/reset?token=abc');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/backend && pnpm test -- mail.service.spec.ts`
Expected: FAIL — `MailService` doesn't exist yet.

- [ ] **Step 5: Implement `MailService`**

```typescript
// apps/backend/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Wraps nodemailer so email delivery is safely no-op (logged) when SMTP_HOST
 * isn't configured — mirrors FcmService's graceful-degradation pattern for
 * push notifications. When configured, this actually sends real email over
 * SMTP; point SMTP_HOST/PORT/USER/PASSWORD at Gmail SMTP, Mailtrap,
 * SendGrid's SMTP relay, or any other provider.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('SMTP_FROM', 'noreply@sportspace.dev');
    this.transporter = this.buildTransporter();
    if (!this.transporter) {
      this.logger.warn(
        'SMTP_HOST not set — email delivery is disabled, reset links will only be logged.',
      );
    }
  }

  private buildTransporter(): nodemailer.Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      return null;
    }
    return nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[dev] Reset link for ${to}: ${resetLink}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Đặt lại mật khẩu SportSpace',
        text: `Nhấn vào đường link sau để đặt lại mật khẩu: ${resetLink}\n\nLink có hiệu lực trong 30 phút.`,
        html: `<p>Nhấn vào đường link sau để đặt lại mật khẩu:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Link có hiệu lực trong 30 phút.</p>`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send password reset email to ${to}: ${err}`);
    }
  }
}
```

```typescript
// apps/backend/src/mail/mail.module.ts
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
```

Register `MailModule` in `apps/backend/src/app.module.ts`'s imports array (alongside the other feature modules).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && pnpm test -- mail.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero tsc errors.

- [ ] **Step 8: Commit**

```bash
cd apps/backend && git add package.json ../../pnpm-lock.yaml .env.example src/mail src/app.module.ts
git commit -m "feat(backend): thêm MailService gửi email qua SMTP (dùng cho đặt lại mật khẩu)"
```

---

### Task 2: `User` gains reset-token columns + migration

**Files:**
- Modify: `apps/backend/src/user/entities/user.entity.ts`
- Create (generated): `apps/backend/src/database/migrations/*-AddPasswordResetToUsers.ts`

**Interfaces:**
- Produces: `User.resetPasswordTokenHash: string | null`, `User.resetPasswordExpiresAt: Date | null` — both hidden from Swagger/API responses (no `@ApiProperty()`), matching `fcmToken`'s treatment.

- [ ] **Step 1: Add the columns**

```typescript
// apps/backend/src/user/entities/user.entity.ts — add after fcmToken
  // No @ApiProperty(): the raw token is never stored (only this hash), and
  // this field must never leak into any API response either way — same
  // rule as passwordHash/fcmToken.
  @Column({ type: 'varchar', nullable: true })
  resetPasswordTokenHash: string | null;

  // No @ApiProperty(): internal expiry bookkeeping, same rule as above.
  @Column({ type: 'timestamptz', nullable: true })
  resetPasswordExpiresAt: Date | null;
```

- [ ] **Step 2: Generate and run the migration**

Run: `cd apps/backend && pnpm run migration:generate src/database/migrations/AddPasswordResetToUsers`
Expected: a new migration adding both nullable columns to `users`.

Run: `cd apps/backend && pnpm run migration:run`
Expected: applies cleanly.

- [ ] **Step 3: Verify build**

Run: `cd apps/backend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd apps/backend && git add src/user/entities/user.entity.ts src/database/migrations
git commit -m "feat(backend): thêm cột lưu hash token và hạn dùng để đặt lại mật khẩu"
```

---

### Task 3: `AuthService`/`AuthController` gain forgot/reset endpoints

**Files:**
- Create: `apps/backend/src/auth/dto/forgot-password.dto.ts`
- Create: `apps/backend/src/auth/dto/reset-password.dto.ts`
- Modify: `apps/backend/src/auth/auth.module.ts`
- Modify: `apps/backend/src/auth/auth.controller.ts` (+ `.spec.ts`)
- Modify: `apps/backend/src/auth/auth.service.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `MailService` from Task 1, `User.resetPasswordTokenHash`/`resetPasswordExpiresAt` from Task 2.
- Produces: `POST /auth/forgot-password` (body `{ email }`, always 200). `POST /auth/reset-password` (body `{ token, newPassword }`, 200 on success, 400 on invalid/expired token).

- [ ] **Step 1: Write the DTOs**

```typescript
// apps/backend/src/auth/dto/forgot-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
```

```typescript
// apps/backend/src/auth/dto/reset-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

- [ ] **Step 2: Write the failing unit tests**

Add to `apps/backend/src/auth/auth.service.spec.ts` — this file's `beforeEach` constructs `service = new AuthService(userRepo, jwtService, config)`; you must add a mocked `MailService` as a 4th constructor argument once the service's constructor changes in Step 4, updating this line too. Add:

```typescript
import { createMock, DeepMocked } from '@golevelup/ts-jest';
// (MailService import added alongside existing imports)
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

// inside describe('AuthService', ...), add to the existing `let` declarations:
  let mailService: DeepMocked<MailService>;

// inside beforeEach, add:
    mailService = createMock<MailService>();
// and change the final line to:
    service = new AuthService(userRepo, jwtService, config, mailService);

  describe('forgotPassword', () => {
    it('stores a hashed token and sends an email when the user exists', async () => {
      const user = buildUser();
      userRepo.findOne.mockResolvedValue(user);
      config.get.mockImplementation((key: string) => {
        if (key === 'WEB_URL') return 'http://localhost:3001';
        return undefined;
      });

      await service.forgotPassword({ email: user.email });

      expect(userRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          resetPasswordTokenHash: expect.any(String),
          resetPasswordExpiresAt: expect.any(Date),
        }),
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        user.email,
        expect.stringContaining('http://localhost:3001/reset-password?token='),
      );
    });

    it('does nothing and does not call sendMail when the email does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'nobody@example.com' }),
      ).resolves.toBeUndefined();
      expect(userRepo.update).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password and clears the reset fields for a valid unexpired token', async () => {
      const rawToken = 'a-raw-token';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const user = buildUser({
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      userRepo.findOne.mockResolvedValue(user);

      await service.resetPassword({ token: rawToken, newPassword: 'NewPassword123' });

      expect(userRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
        }),
      );
      const updateArg = userRepo.update.mock.calls[0][1] as { passwordHash: string };
      expect(
        await bcrypt.compare('NewPassword123', updateArg.passwordHash),
      ).toBe(true);
    });

    it('throws BadRequestException for an unknown or expired token', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'NewPassword123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
```

(`BadRequestException` needs adding to this file's existing `@nestjs/common` import line. `buildUser`'s helper needs `resetPasswordTokenHash: null, resetPasswordExpiresAt: null` added to its default return object so existing tests that don't override these keep working — check the current helper and extend it, don't replace it.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- auth.service.spec.ts`
Expected: FAIL — `forgotPassword`/`resetPassword` don't exist yet, constructor signature mismatch.

- [ ] **Step 4: Implement `AuthService`'s new methods**

```typescript
// apps/backend/src/auth/auth.service.ts — add imports:
import { BadRequestException, ... } from '@nestjs/common'; // add BadRequestException to the existing import
import * as crypto from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { MoreThan } from 'typeorm'; // add MoreThan to the existing typeorm import if there is one, else add this import

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// change the constructor to:
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

// add these two methods (public, alongside register/login):
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.userRepo.update(user.id, {
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3001');
    const resetLink = `${webUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetLink);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const user = await this.userRepo.findOne({
      where: {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: MoreThan(new Date()),
      },
    });
    if (!user) {
      throw new BadRequestException(
        'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.userRepo.update(user.id, {
      passwordHash,
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
    });
  }
```

Check the file's actual current `typeorm`/`@nestjs/common` import lines before adding `MoreThan`/`BadRequestException` — add to the existing import statements, don't create duplicate import lines for the same module.

- [ ] **Step 5: Wire `MailModule` into `AuthModule`**

```typescript
// apps/backend/src/auth/auth.module.ts — add to imports array
    MailModule,
```

Add `import { MailModule } from '../mail/mail.module';`.

- [ ] **Step 6: Run unit tests to verify they pass**

Run: `cd apps/backend && pnpm test -- auth.service.spec.ts`
Expected: PASS

- [ ] **Step 7: Wire the controller endpoints**

```typescript
// apps/backend/src/auth/auth.controller.ts — add imports and methods
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi email đặt lại mật khẩu (luôn trả 200)' })
  @ApiResponse({ status: 200 })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng token từ email' })
  @ApiResponse({ status: 200 })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }
```

Check `apps/backend/src/auth/auth.controller.spec.ts` — it likely constructs `new AuthController(authService)` with `authService = createMock<AuthService>()`; if it asserts specific method calls for `register`/`login` only, no change needed since `createMock` auto-mocks new methods. Add a `forwards forgotPassword/resetPassword to the service` test pair mirroring the file's existing style if it has per-method delegation tests.

- [ ] **Step 8: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors.

- [ ] **Step 9: Commit**

```bash
cd apps/backend && git add src/auth
git commit -m "feat(backend): thêm API quên mật khẩu và đặt lại mật khẩu"
```

---

### Task 4: e2e tests

**Files:**
- Modify: `apps/backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: e2e coverage for the full forgot→reset round-trip, using a `MailService` DI override to capture the reset link without hitting real SMTP.

- [ ] **Step 1: Write the failing e2e test**

Read `apps/backend/test/auth.e2e-spec.ts`'s existing `beforeAll` (module setup, likely `Test.createTestingModule({ imports: [AppModule] })`) and add a DI override for `MailService`:

```typescript
// apps/backend/test/auth.e2e-spec.ts — add near the top-level imports
import { MailService } from '../src/mail/mail.service';

// In this file's relevant describe block's beforeAll, change the module
// builder to override MailService with a capturing test double — check the
// exact current TestingModule builder chain (Test.createTestingModule({...}))
// and insert .overrideProvider(MailService).useValue(mailServiceMock) before
// .compile(), following whatever pattern this file already uses for
// similar overrides (check other e2e spec files, e.g. how PaymentService or
// similar external-service mocking is already done elsewhere in this repo's
// e2e suite, if any precedent exists — otherwise this is a new pattern,
// implement it as the standard NestJS testing override:
//   const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
//     .overrideProvider(MailService)
//     .useValue({ sendPasswordResetEmail: jest.fn() })
//     .compile();
// and keep a reference to that jest.fn() to inspect its call args in tests below.

describe('Forgot/reset password (e2e)', () => {
  it('full flow: forgot-password always 200, captures a real reset link, reset-password with the captured token succeeds', async () => {
    const passwordHash = await bcrypt.hash('OldPassword123', 10);
    const user = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
    });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: user.email })
      .expect(200);

    expect(mailServiceMock.sendPasswordResetEmail).toHaveBeenCalledWith(
      user.email,
      expect.stringContaining('/reset-password?token='),
    );
    const link = mailServiceMock.sendPasswordResetEmail.mock.calls[0][1] as string;
    const token = new URL(link).searchParams.get('token');

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'NewPassword456' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'NewPassword456' })
      .expect(200);

    await dataSource.getRepository(User).delete({ id: user.id });
  });

  it('returns 200 for an unknown email without sending an email', async () => {
    mailServiceMock.sendPasswordResetEmail.mockClear();
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'no-such-user@example.com' })
      .expect(200);
    expect(mailServiceMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('rejects reset-password with an invalid token (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'NewPassword456' })
      .expect(400);
  });
});
```

(Adapt variable names — `dataSource`, `faker`, `bcrypt`, `User` import — to whatever this file's existing top-level setup already provides; check the real file before writing, this is likely already imported for other tests in the same file.)

- [ ] **Step 2: Run test to verify it fails, then implement the override, then verify it passes**

Run: `cd apps/backend && pnpm test:e2e -- auth.e2e-spec.ts`
Expected: FAIL first without the override wired, then PASS once Step 1's override is correctly in place. (Known environment quirk, not a bug: the e2e jest process sometimes doesn't exit cleanly — redirect to a file if a run seems to hang.)

- [ ] **Step 3: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors. This closes out the backend portion of this plan.

- [ ] **Step 4: Commit**

```bash
cd apps/backend && git add test/auth.e2e-spec.ts
git commit -m "test(backend): thêm e2e cho luồng quên mật khẩu và đặt lại mật khẩu"
```

---

### Task 5: Regenerate the API client

**Files:**
- Modify (tracked): `openapi.json`
- Modify (generated, git-ignored): `packages/shared/src/generated/**`, `packages/shared/dist/**`

**Interfaces:**
- Consumes: every backend change from Tasks 1-4.
- Produces: `authControllerForgotPassword`, `authControllerResetPassword` on the `auth` client (confirm exact names, don't guess).

- [ ] **Step 1: Regenerate**

Run:
```bash
cd apps/backend && pnpm run swagger:export
cd ../.. && pnpm run generate:api
cd packages/shared && pnpm build
```
Expected: clean build.

- [ ] **Step 2: Confirm the generated function names**

Run: `grep -n "^const auth" packages/shared/src/generated/auth/auth.ts`
Note the exact names for Tasks 6 and 7.

- [ ] **Step 3: Verify downstream compiles**

Run: `cd apps/backend && pnpm exec tsc --noEmit` (should still be clean), `cd apps/web && pnpm exec tsc --noEmit`, `cd apps/mobile && pnpm exec tsc --noEmit` (expect no new errors from this task alone — it's a pure regen).

- [ ] **Step 4: Commit**

```bash
git add openapi.json
git commit -m "chore(shared): cập nhật openapi.json sau khi backend hỗ trợ quên/đặt lại mật khẩu"
```

---

### Task 6: Web — forgot-password + reset-password pages

**Files:**
- Create: `apps/web/src/app/forgot-password/page.tsx`
- Create: `apps/web/src/app/forgot-password/forgot-password-form.tsx`
- Create: `apps/web/src/app/forgot-password/forgot-password-form.test.tsx`
- Create: `apps/web/src/app/forgot-password/actions.ts`
- Create: `apps/web/src/app/forgot-password/actions.test.ts`
- Create: `apps/web/src/app/reset-password/page.tsx`
- Create: `apps/web/src/app/reset-password/reset-password-form.tsx`
- Create: `apps/web/src/app/reset-password/reset-password-form.test.tsx`
- Create: `apps/web/src/app/reset-password/actions.ts`
- Create: `apps/web/src/app/reset-password/actions.test.ts`
- Modify: `apps/web/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `authControllerForgotPassword`/`authControllerResetPassword` from Task 5 (exact names confirmed there — use those).

- [ ] **Step 1: Write the failing action tests**

Mirror `apps/web/src/app/login/actions.ts`/`actions.test.ts`'s exact style (`createAnonymousApiClient`, zod validation, `isAxiosError` error mapping — already shown to you in this plan's research; re-read the real files if needed). Write tests for `forgotPassword` (validates email, calls `authControllerForgotPassword`, always returns a success state — no error path to distinguish since the backend always 200s) and `resetPassword` (validates token+newPassword, calls `authControllerResetPassword`, redirects to `/login` on success, surfaces a 400 as a form error).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- forgot-password reset-password`
Expected: FAIL — files don't exist yet.

- [ ] **Step 3: Implement `forgot-password`**

```typescript
// apps/web/src/app/forgot-password/actions.ts
'use server';

import { z } from 'zod';
import { createAnonymousApiClient } from '@/lib/api-client';

const forgotPasswordSchema = z.object({
  email: z.email('Email không hợp lệ'),
});

export interface ForgotPasswordActionState {
  error?: string;
  success?: boolean;
}

export async function forgotPassword(
  _prevState: ForgotPasswordActionState | undefined,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const { auth } = createAnonymousApiClient();
  try {
    await auth.authControllerForgotPassword(parsed.data);
  } catch {
    // Backend always 200s on this endpoint by design; a network/5xx error
    // here is an infra problem, not a "no such email" signal — still show
    // the generic success message so the response never reveals which case
    // occurred, consistent with the no-enumeration requirement.
  }

  return { success: true };
}
```

```tsx
// apps/web/src/app/forgot-password/forgot-password-form.tsx
'use client';

import { useActionState } from 'react';
import { forgotPassword, type ForgotPasswordActionState } from './actions';

const initialState: ForgotPasswordActionState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState);

  if (state?.success) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
      </button>
    </form>
  );
}
```

```tsx
// apps/web/src/app/forgot-password/page.tsx
import Link from 'next/link';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Quên mật khẩu</h1>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm hover:underline">
        Quay lại đăng nhập
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Implement `reset-password`**

```typescript
// apps/web/src/app/reset-password/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAnonymousApiClient } from '@/lib/api-client';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Thiếu token'),
  newPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
});

export interface ResetPasswordActionState {
  error?: string;
}

export async function resetPassword(
  _prevState: ResetPasswordActionState | undefined,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const { auth } = createAnonymousApiClient();
  try {
    await auth.authControllerResetPassword(parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 400) {
      return { error: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' };
    }
    return { error: 'Không thể đặt lại mật khẩu, vui lòng thử lại' };
  }

  redirect('/login');
}
```

```tsx
// apps/web/src/app/reset-password/reset-password-form.tsx
'use client';

import { useActionState } from 'react';
import { resetPassword, type ResetPasswordActionState } from './actions';

const initialState: ResetPasswordActionState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="newPassword" className="text-sm font-medium">
          Mật khẩu mới
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
      </button>
    </form>
  );
}
```

```tsx
// apps/web/src/app/reset-password/page.tsx
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">
          Thiếu token đặt lại mật khẩu. Vui lòng dùng link trong email.
        </p>
      )}
    </div>
  );
}
```

Check whether the generated `authControllerForgotPassword`/`authControllerResetPassword` return `Promise<AxiosResponse<void>>` and whether calling them with no explicit response typing needs adjustment — verify against the real generated file from Task 5 before finalizing.

- [ ] **Step 5: Add a "Quên mật khẩu?" link to the login page**

In `apps/web/src/app/login/page.tsx`, add a link to `/forgot-password` below `<LoginForm />` (or inside it — check the current file's exact structure and place it in a way consistent with the page's existing layout).

- [ ] **Step 6: Run tests and typecheck**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero new errors.

- [ ] **Step 7: Manually verify in the browser**

Per CLAUDE.md's UI-testing rule: start `apps/backend` and `apps/web` dev servers, open `/forgot-password`, submit an email, confirm the success message. If `SMTP_HOST` is unset in your dev `.env`, check the backend console log for the `[dev] Reset link for ...` line instead of a real email, copy the token from it, and manually visit `/reset-password?token=<token>` to confirm the reset form works end-to-end. Report exactly what you did and observed — note explicitly whether real SMTP was configured or you used the dev-log fallback.

- [ ] **Step 8: Commit**

```bash
cd apps/web && git add src/app/forgot-password src/app/reset-password src/app/login/page.tsx
git commit -m "feat(web): thêm trang quên mật khẩu và đặt lại mật khẩu"
```

---

### Task 7: Mobile — `ForgotPasswordScreen` + navigation

**Files:**
- Create: `apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx`
- Create: `apps/mobile/src/screens/auth/__tests__/ForgotPasswordScreen.test.tsx`
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Modify: `apps/mobile/src/screens/auth/LoginScreen.tsx`

**Interfaces:**
- Consumes: `authControllerForgotPassword` from Task 5 (exact name confirmed there).
- Produces: `AuthStackParamList.ForgotPassword: undefined`; a "Quên mật khẩu?" link on `LoginScreen` navigating to it.

- [ ] **Step 1: Add the route**

```typescript
// apps/mobile/src/navigation/types.ts — AuthStackParamList
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};
```

```tsx
// apps/mobile/src/navigation/RootNavigator.tsx — add alongside the existing AuthStack.Screen entries
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
// ...
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
```

- [ ] **Step 2: Add the link on `LoginScreen`**

In `apps/mobile/src/screens/auth/LoginScreen.tsx`, add below the existing "Chưa có tài khoản? Đăng ký" `Pressable`:

```tsx
      <Pressable testID="login-go-forgot-password" onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Quên mật khẩu?</Text>
      </Pressable>
```

- [ ] **Step 3: Write the failing screen test**

```typescript
// apps/mobile/src/screens/auth/__tests__/ForgotPasswordScreen.test.tsx
import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';
import type { AuthStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const goBack = jest.fn();
const navigation = { goBack } as unknown as NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

async function renderScreen() {
  return render(
    <ForgotPasswordScreen
      navigation={navigation}
      route={{ key: 'ForgotPassword', name: 'ForgotPassword', params: undefined }}
    />,
  );
}

describe('ForgotPasswordScreen', () => {
  afterEach(() => goBack.mockClear());

  it('gửi yêu cầu và hiện thông báo kiểm tra email', async () => {
    server.use(
      http.post('*/auth/forgot-password', () => HttpResponse.json(undefined, { status: 200 })),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.type(screen.getByTestId('forgot-password-email'), 'test@example.com');
    await user.press(screen.getByTestId('forgot-password-submit'));

    expect(await screen.findByTestId('forgot-password-success')).toBeTruthy();
  });

  it('báo lỗi khi thiếu email', async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('forgot-password-submit'));

    expect(await screen.findByTestId('forgot-password-error')).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- ForgotPasswordScreen`
Expected: FAIL — screen doesn't exist yet.

- [ ] **Step 5: Implement `ForgotPasswordScreen`**

Mirror `LoginScreen.tsx`'s structure closely (already shown to you in this plan's research):

```tsx
// apps/mobile/src/screens/auth/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authApi } from '../../api/client';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.authControllerForgotPassword({ email: email.trim() });
      setSuccess(true);
    } catch {
      setError('Không thể gửi yêu cầu, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container} testID="forgot-password-success">
        <Text style={styles.title}>Kiểm tra email của bạn</Text>
        <Text>Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.</Text>
        <Pressable testID="forgot-password-back-to-login" onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Quay lại đăng nhập</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="forgot-password-screen">
      <Text style={styles.title}>Quên mật khẩu</Text>
      <TextInput
        testID="forgot-password-email"
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {error ? (
        <Text testID="forgot-password-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="forgot-password-submit"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Gửi link đặt lại mật khẩu</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#dc2626' },
  link: { color: '#1d4ed8', textAlign: 'center', marginTop: 8 },
});
```

Note: `apps/mobile/src/api/client.ts` needs `import { getAuth } from '@sportspace/shared'` already present (it exports `authApi = getAuth(apiClient)` per the existing file) — `authControllerForgotPassword` becomes available automatically once Task 5's regeneration lands, no new client wiring needed here since `authApi` already exists.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/mobile && pnpm test -- ForgotPasswordScreen`
Expected: PASS (2 tests)

- [ ] **Step 7: Run full mobile suite**

Run: `cd apps/mobile && pnpm test`
Expected: all pass — also catches any `AuthStackParamList` type-change fallout in other test files (unlikely here since `ForgotPassword: undefined` is additive, not modifying existing routes).

Run: `cd apps/mobile && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd apps/mobile && git add src/navigation src/screens/auth
git commit -m "feat(mobile): thêm màn hình quên mật khẩu"
```
