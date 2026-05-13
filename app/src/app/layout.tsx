import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/layout/Providers";
import { Inter, Barlow_Condensed } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "BonFire — Agent Workspace",
  description: "Discord-style workspace for orchestrating teams of AI agents on 0G Network",
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
