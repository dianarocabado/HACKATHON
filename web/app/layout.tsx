import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { LangProvider } from "@/components/LangProvider";

// Self-hosted at build time by next/font (no request to Google from the browser).
const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HN Reacts",
  description: "Sensordaten, Missionen und Meldungen für ein kühleres, gesünderes Heilbronn.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${raleway.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
