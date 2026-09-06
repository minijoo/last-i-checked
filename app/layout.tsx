import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { PageSwitcher } from "@/components/PageSwitcher";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Last I Checked",
  description:
    "How your stocks, weather, and sportsbook odds have changed since the last time you checked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppNav />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-28">
          {children}
        </main>
        <PageSwitcher />
      </body>
    </html>
  );
}
