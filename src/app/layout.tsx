import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grupo Nogueira OS",
  description: "Sistema de gestao da agencia - multi-tenant white-label",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
