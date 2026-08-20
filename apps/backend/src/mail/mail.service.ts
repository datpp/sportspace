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
