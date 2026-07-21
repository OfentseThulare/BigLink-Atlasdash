import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partnership Ledger | Big Link Consulting",
  description: "Shared financial reconciliation for Big Link Consulting and Atlas Consulting Group.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>{children}</body>
    </html>
  );
}
