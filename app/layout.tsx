import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life Regime Tracker",
  description: "Low-friction daily tracking, tasks, calendar context, and weekly JSON exports."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
