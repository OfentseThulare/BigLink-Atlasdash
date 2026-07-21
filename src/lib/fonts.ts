import { IBM_Plex_Mono, Outfit, Public_Sans } from "next/font/google";

export const displayFont = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const bodyFont = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const dataFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500", "600"],
  display: "swap",
});
