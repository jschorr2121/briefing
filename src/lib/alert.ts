import { createTransport } from 'nodemailer';

/**
 * Send an alert email on cron job failures.
 * Sends to ALERT_EMAIL if set, otherwise falls back to SMTP_USER.
 */
export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const alertEmail = process.env.ALERT_EMAIL || smtpUser;

  if (!smtpUser || !smtpPass || !alertEmail) {
    console.error(`🚨 ALERT (no SMTP configured): ${subject} — ${body}`);
    return;
  }

  try {
    const transporter = createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Briefing Alerts" <${smtpUser}>`,
      to: alertEmail,
      subject: `🚨 ${subject}`,
      text: body,
    });

    console.log(`🚨 Alert email sent: ${subject}`);
  } catch (err) {
    // Don't throw — alerting should never take down the cron
    console.error(`Failed to send alert email:`, err);
  }
}
