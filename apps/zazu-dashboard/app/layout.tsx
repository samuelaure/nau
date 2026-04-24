import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "./components/SessionProvider";

export const metadata: Metadata = {
  title: "Zazŭ Command Center",
  description: "Administrative console for Zazu Bot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
