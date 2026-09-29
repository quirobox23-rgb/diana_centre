import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estètica Diana · Centre de Bellesa, Agenda de 3 Sales i Cites",
  description: "Aplicació de gestió integral per al centre d'estètica Diana amb calendari de sales múltiple, gestió de serveis, horaris i simulador de resposta automàtica mòbil amb 3 opcions d'horari.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ca">
      <body className="bg-[#faf8f6] text-gray-900 antialiased selection:bg-rose-200 selection:text-rose-900">
        {children}
      </body>
    </html>
  );
}
