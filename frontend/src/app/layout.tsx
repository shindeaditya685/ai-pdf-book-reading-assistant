import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RootLayoutInner } from "@/components/root-layout-inner";

const geistSans = {
  variable: "--font-geist-sans",
};

const geistMono = {
  variable: "--font-geist-mono",
};

const lora = {
  variable: "--font-geist-serif",
};

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
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} antialiased bg-background text-foreground`}
      >
        <RootLayoutInner>{children}</RootLayoutInner>
        <Toaster />
      </body>
    </html>
  );
}
