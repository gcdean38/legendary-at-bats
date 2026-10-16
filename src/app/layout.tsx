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

export const metadata: Metadata = {
  metadataBase: new URL(SHARE_GAME_URL),
  title: "Legendary At Bats",
  description: siteDescription,
  applicationName: "Legendary At Bats",
  // Paths must be relative to metadataBase (no leading "/"). A root-absolute
  // "/icon.png" ignores the /legendary-at-bats basePath on GitHub Pages and 404s.
  icons: {
    icon: [
      { url: "favicon.ico", sizes: "any" },
      { url: "icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["favicon.ico"],
    apple: [{ url: "apple-touch-icon.png", sizes: "180x180" }],
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
