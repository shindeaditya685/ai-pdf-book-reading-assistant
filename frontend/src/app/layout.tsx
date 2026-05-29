import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RootLayoutInner } from "@/components/root-layout-inner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDF Reader AI - Interactive PDF Reading Assistant",
  description:
    "Read PDFs interactively and understand difficult words instantly. Click any word to get AI-powered contextual meanings, pronunciation, and translations.",
  keywords: [
    "PDF Reader",
    "AI Dictionary",
    "Interactive Reading",
    "Context-Aware",
    "Pronunciation",
    "Translation",
  ],
  authors: [{ name: "PDF Reader AI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
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
                  var theme = JSON.parse(localStorage.getItem('pdf-reader-ai-storage') || '{}').theme || 'dark';
                  document.documentElement.classList.add(theme);
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <RootLayoutInner>{children}</RootLayoutInner>
        <Toaster />
      </body>
    </html>
  );
}
