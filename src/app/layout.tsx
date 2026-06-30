import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";

const pixelHeading = Press_Start_2P({
  variable: "--font-pixel-heading",
  subsets: ["latin"],
  weight: "400",
});

const pixelBody = VT323({
  variable: "--font-pixel-body",
  subsets: ["latin"],
  weight: "400",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "WOOFonBASE",
  description: "Translate English to Woof and back. Est. 1998.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${pixelHeading.variable} ${pixelBody.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
