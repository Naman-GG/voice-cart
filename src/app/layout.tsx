import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Noto_Sans_Devanagari, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

/** Item names: clear and legible, never a script face. */
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/** Quantities, prices and labels — a tally is monospace, like a docket. */
const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** So Hindi sets properly rather than falling back to a system default. */
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Voice Cart — Voice Command Shopping Assistant",
  description:
    "Build your shopping list by voice in English or Hindi, with smart suggestions, automatic categorisation and voice-activated product search.",
  applicationName: "Voice Cart",
  appleWebApp: { capable: true, title: "Voice Cart", statusBarStyle: "default" },
  openGraph: {
    title: "Voice Cart — Voice Command Shopping Assistant",
    description: "Speak your shopping list. English and Hindi, with smart suggestions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#e2dfd7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${instrument.variable} ${splineMono.variable} ${devanagari.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
