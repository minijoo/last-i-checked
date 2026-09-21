import type { Metadata, Viewport } from "next";
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
  appleWebApp: {
    capable: true,
    title: "Last I Checked",
    statusBarStyle: "default",
  },
};

// `colorScheme` + `themeColor` live on the viewport export in Next 13.2+.
// `colorScheme: "light dark"` emits <meta name="color-scheme">, which — with the
// same declaration in globals.css — is what makes an iOS standalone PWA honor
// the device's dark mode. The theme-color pair keeps the standalone status bar
// in sync with the active scheme.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#090b0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppNav />
        {/* overflow-x-clip: an open dropdown can extend past a narrow viewport; clip it
            rather than let the page scroll sideways. Unlike `hidden`, `clip` blocks
            programmatic/focus scrolling too and leaves the y-axis visible. */}
        <main className="mx-auto w-full max-w-3xl flex-1 overflow-x-clip px-4 pt-8 pb-28">
          {children}
        </main>
        <PageSwitcher />
      </body>
    </html>
  );
}
