import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import "./globals.css";
import { getConfig } from "@/lib/wagmi-config";
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
  description: "WOOF Protocol is here to bring the meme meta back to Base.",
  openGraph: {
    title: "WOOFonBASE",
    description: "WOOF Protocol is here to bring the meme meta back to Base.",
  },
  twitter: {
    title: "WOOFonBASE",
    description: "WOOF Protocol is here to bring the meme meta back to Base.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookie = (await headers()).get("cookie") ?? "";
  const initialState = cookieToInitialState(getConfig(), cookie);

  return (
    <html lang="en" className={`${pixelHeading.variable} ${pixelBody.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <WalletProvider initialState={initialState}>{children}</WalletProvider>
      </body>
    </html>
  );
}
