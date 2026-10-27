import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Heilbronn wirkt",
  description: "Sensordaten, Missionen und Meldungen für ein kühleres, gesünderes Heilbronn.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
