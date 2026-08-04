import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RootLayoutInner } from "@/components/root-layout-inner";

// Performance fix (P11): previously the font "variables" were plain objects
// (no next/font call), so --font-geist-sans / --font-geist-serif / --font-geist-mono
// were undefined and the whole app fell back to the browser default font.
// Now we load real optimized fonts via next/font/google with subset + swap.
const geistSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-geist-serif",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "PDFMindAI - AI PDF Reading Assistant",
    template: "%s | PDFMindAI",
  },
  description:
    "Upload PDFs and read interactively with AI. Click any word for instant contextual meanings, pronunciation, translations, and summaries. The smart PDF reading assistant.",
  keywords: [
    "PDF Reader",
    "AI Dictionary",
    "Interactive Reading",
    "Context-Aware",
    "Pronunciation",
    "Translation",
    "PDFMindAI",
    "AI PDF Reader",
  ],
  authors: [{ name: "PDFMindAI" }],
  icons: {
    icon: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "PDFMindAI - AI PDF Reading Assistant",
    description: "Upload PDFs and read interactively with AI. Click any word for instant contextual meanings.",
    url: "https://pdfmindai.dpdns.org",
    siteName: "PDFMindAI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('pdf-reader-ai-theme') || 'dark';
                  document.documentElement.classList.add(theme);
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
                try {
                  var accent = localStorage.getItem('pdf-reader-ai-theme-accent') || 'emerald';
                  document.documentElement.classList.add('accent-' + accent);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} antialiased bg-canvas text-ink`}
      >
        {/* UI fix (U12): skip-to-content link for keyboard / screen-reader users. */}
        <a href="#main-content" className="skip-link rounded-md bg-background px-4 py-2 text-sm font-medium shadow-lg border border-border">
          Skip to content
        </a>
        <RootLayoutInner>{children}</RootLayoutInner>
        <Toaster />
      </body>
    </html>
  );
}
