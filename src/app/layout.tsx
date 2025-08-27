import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "Duck Dev Copilot",
  description: "MCP-powered tools for DuckChain development. Use the examples or ask freely.",
  icons: [{ rel: "icon", url: "/logo-nobg.png" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} bg-zinc-950 text-zinc-100`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
