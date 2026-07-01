import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Macro",
  description: "A signed-in calorie and macro tracker with meal estimation.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
