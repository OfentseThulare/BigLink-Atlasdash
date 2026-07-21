import type { Metadata } from "next";
import { bodyFont, dataFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partnership Ledger | Big Link Consulting",
  description: "Shared financial reconciliation for Big Link Consulting and Atlas Consulting Group.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZA"
      className={`${displayFont.variable} ${bodyFont.variable} ${dataFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
