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
