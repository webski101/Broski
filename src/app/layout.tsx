import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk, Syne } from "next/font/google";
import "./globals.css";

const broskiSans = Space_Grotesk({
  variable: "--font-broski-sans",
  subsets: ["latin"],
});

const broskiDisplay = Syne({
  variable: "--font-broski-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const broskiMono = JetBrains_Mono({
  variable: "--font-broski-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Broski — Mandate-bound AP agent",
  description:
    "Hire Broski with a signed job contract. ArmorIQ enforces intent on every MCP tool call.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${broskiSans.variable} ${broskiDisplay.variable} ${broskiMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-broski-sans)]">
        {children}
      </body>
    </html>
  );
}
