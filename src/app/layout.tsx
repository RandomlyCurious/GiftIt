import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GiftMatch",
  description: "Trouvez le cadeau parfait pour vos proches.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
