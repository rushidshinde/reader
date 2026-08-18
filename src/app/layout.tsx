import type { Metadata, Viewport } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Personal Kindle Reader",
  description: "Personal Kindle & Apple Books-inspired PDF library and reader web app",
  manifest: "/reader/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kindle Reader"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" scroll-behaviour="smooth">
      <body className="antialiased font-sans bg-stone-50 dark:bg-[#0f1115] text-stone-900 dark:text-stone-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
