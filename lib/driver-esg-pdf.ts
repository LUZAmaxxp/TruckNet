/**
 * lib/driver-esg-pdf.ts
 *
 * Renders an EsgDataPackage to a PDF Buffer using Puppeteer.
 * Returns a Buffer suitable for streaming directly in a Next.js API route.
 */

import puppeteer from "puppeteer";

export async function renderDriverEsgPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
