import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/Providers";
import "@livekit/components-styles";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TruckConnect",
  description: "Real-time communication platform for truck drivers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrumentSans.variable}`}>
      <body style={{ fontFamily: "var(--font-body)" }}>
        <Providers>
          {children}
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                boxShadow: "var(--shadow-md)",
                fontFamily: "var(--font-body)",
                color: "var(--ink)",
                borderRadius: "10px",
                fontSize: "12px",
                padding: "10px 12px",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
