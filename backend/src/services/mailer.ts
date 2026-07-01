import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Thin SMTP wrapper. When SMTP is not configured the mailer logs the message
 * instead of sending, so the system remains fully functional in dev/test.
 */
export class Mailer {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (!env.smtpConfigured) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      });
    }
    return this.transporter;
  }

  async send(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn(
        { to: options.to, subject: options.subject },
        'SMTP not configured - email logged instead of sent',
      );
      return;
    }
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html ?? `<pre style="font-family:inherit">${options.text}</pre>`,
    });
  }
}
