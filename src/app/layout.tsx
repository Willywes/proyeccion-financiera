import "@/styles/globals.css";

import { type Metadata } from "next";
import { Open_Sans } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "Proyección Financiera",
  description: "Proyección Financiera",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const openSans = Open_Sans({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${openSans.className}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
