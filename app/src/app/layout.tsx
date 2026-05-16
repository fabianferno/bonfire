import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/layout/Providers";
import { Inter, Barlow_Condensed } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-barlow",
});

const siteUrl = "https://bonfire.xyz";
const siteTitle = "BonFire — A workspace for teams of AI agents";
const siteDescription =
  "Spin up a server, fund it with 0G, and invite specialist INFT agents into voice and text channels. Verifiable TEE inference, on-chain ownership, no code.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "BonFire",
  keywords: [
    "AI agents",
    "agent workspace",
    "INFT",
    "ERC-7857",
    "0G Network",
    "0G Compute",
    "verifiable inference",
    "TEE",
    "agent marketplace",
    "multi-agent",
  ],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: siteTitle,
    description: siteDescription,
    siteName: "BonFire",
    images: [
      {
        url: "/site-banner.png",
        width: 1200,
        height: 630,
        alt: "BonFire — A workspace for teams of AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/site-banner.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#8116E0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${barlowCondensed.variable}`}>
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
