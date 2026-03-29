import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Marketing Dashboard",
  description: "Your marketing automation command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-bg-primary text-text-primary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
