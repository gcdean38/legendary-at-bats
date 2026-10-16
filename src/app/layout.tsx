import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Bebas_Neue, Manrope } from "next/font/google";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { SHARE_GAME_URL } from "@/lib/daily";
import "./globals.css";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const siteDescription =
  "Daily challenge: step into legendary MLB playoff at-bats. Recognize the pitch, decide take or swing, aim the zone — and try to change history.";

/** Prefix for static assets — matches next.config basePath on Pages builds. */
const assetBase =
  process.env.GITHUB_PAGES === "true" ? "/legendary-at-bats" : "";

export const metadata: Metadata = {
  metadataBase: new URL(SHARE_GAME_URL),
  title: "Legendary At Bats",
  description: siteDescription,
  applicationName: "Legendary At Bats",
  icons: {
    // Root-absolute under assetBase so localhost and GitHub Pages both resolve.
    // Prefer PNG first — clearer in tabs than a tiny ICO.
    icon: [
      {
        url: `${assetBase}/icon.png`,
        type: "image/png",
        sizes: "512x512",
      },
      { url: `${assetBase}/favicon.ico`, sizes: "any" },
    ],
    shortcut: [`${assetBase}/favicon.ico`],
    apple: [
      { url: `${assetBase}/apple-touch-icon.png`, sizes: "180x180" },
    ],
  },
  openGraph: {
    type: "website",
    url: SHARE_GAME_URL,
    siteName: "Legendary At Bats",
    title: "Legendary At Bats",
    description: siteDescription,
    images: [
      {
        url: "og.jpg",
        width: 1280,
        height: 720,
        alt: "Legendary At Bats — step into legendary playoff moments",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legendary At Bats",
    description: siteDescription,
    images: ["og.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
      <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
    </html>
  );
}
