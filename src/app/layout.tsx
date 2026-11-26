import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estètica Diana · Centre de Bellesa, Agenda de 3 Sales i Cites",
  description: "Aplicació de gestió integral per al centre d'estètica Diana amb calendari de sales múltiple, gestió de serveis, horaris i oficina amb les 3 cabines i l'Aura, l'agent de WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ca" className="bg-sorra">
      <body className="bg-sorra text-stone-900 antialiased selection:bg-terra-200 selection:text-terra-900">
        {children}
      </body>
    </html>
  );
}
