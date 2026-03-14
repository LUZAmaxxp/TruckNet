/**
 * lib/esg-email.ts
 *
 * Sends ESG report notification emails using nodemailer.
 * Gracefully skipped when SMTP_HOST is not configured.
 */

import nodemailer from "nodemailer";

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EsgReportEmailOptions {
  to:          string;
  driverName:  string;
  periodStart: string;
  periodEnd:   string;
  reportId:    string;
  downloadUrl: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT ?? "587", 10),
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ?? "",
    } : undefined,
  });
}

export async function sendEsgReportEmail(opts: EsgReportEmailOptions): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[esg-email] SMTP not configured — skipping email for report", opts.reportId);
    return;
  }

  const from    = process.env.SMTP_FROM ?? "noreply@trucknet.app";
  const subject = `Rapport ESG conducteur — ${opts.driverName} — ${opts.periodStart} / ${opts.periodEnd}`;

  const safeName        = escapeHtml(opts.driverName);
  const safePeriodStart = escapeHtml(opts.periodStart);
  const safePeriodEnd   = escapeHtml(opts.periodEnd);
  const safeDownloadUrl = escapeHtml(opts.downloadUrl);

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a2e;max-width:600px">
      <div style="background:#0f2d5c;color:#fff;padding:24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Rapport ESG / RSE — TruckNet</h1>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p>Bonjour,</p>
        <p>Le rapport ESG/RSE pour le conducteur <strong>${safeName}</strong> est disponible.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:6px;font-weight:600;width:40%">Conducteur</td><td style="padding:6px">${safeName}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:6px;font-weight:600">Période</td><td style="padding:6px">${safePeriodStart} → ${safePeriodEnd}</td></tr>
        </table>
        <p>
          <a href="${safeDownloadUrl}"
             style="display:inline-block;background:#0f2d5c;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700">
            Consulter et télécharger le rapport
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;margin-top:16px">
          Ce rapport a été généré automatiquement par TruckNet. Le PDF et le CSV sont disponibles depuis le lien ci-dessus.
        </p>
      </div>
    </div>`;

  await transporter.sendMail({ from, to: opts.to, subject, html });
  console.log(`[esg-email] Email sent to ${opts.to} for report ${opts.reportId}`);
}
