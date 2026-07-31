import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astrea Extractor",
  description: "Biblioteca documental para libros procesados desde Astrea.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

