import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string | null;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function createTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export async function sendEmail(cfg: SmtpConfig, opts: SendEmailOptions) {
  const transporter = createTransport(cfg);
  const from = cfg.fromName ? `"${cfg.fromName}" <${cfg.fromEmail}>` : cfg.fromEmail;
  await transporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
}

export async function verifySmtp(cfg: SmtpConfig): Promise<void> {
  const transporter = createTransport(cfg);
  await transporter.verify();
}
