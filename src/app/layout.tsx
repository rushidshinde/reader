import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Kindle Reader",
  description: "Personal Kindle-inspired PDF library and reader",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-stone-50 dark:bg-[#0f1115] text-stone-900 dark:text-stone-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
