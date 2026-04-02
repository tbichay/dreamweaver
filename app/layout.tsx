import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { deDE } from "@clerk/localizations";
import CookieBanner from "./components/CookieBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "KoalaTree — Personalisierte KI-Geschichten für Kinder & Erwachsene",
    template: "%s | KoalaTree",
  },
  description:
    "KoalaTree erstellt personalisierte Gute-Nacht-Geschichten und Audio-Hörspiele mit KI. Der weise Koala Koda erzählt Geschichten, die dein Kind stärken — Selbstbewusstsein, Mut und Dankbarkeit.",
  keywords: [
    "Gute-Nacht-Geschichten",
    "personalisierte Geschichten",
    "KI Geschichten",
    "Hörspiele für Kinder",
    "Kindergeschichten",
    "Audio-Hörspiel",
    "KoalaTree",
    "Einschlafgeschichten",
    "Traumreise Kinder",
  ],
  openGraph: {
    title: "KoalaTree — Personalisierte KI-Geschichten für Kinder & Erwachsene",
    description:
      "Der weise Koala Koda erzählt personalisierte Gute-Nacht-Geschichten als Audio-Hörspiel. Jede Geschichte ist einzigartig — mit dem Namen, den Interessen und den Themen deines Kindes.",
    url: "https://koalatree.com",
    siteName: "KoalaTree",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KoalaTree — Personalisierte KI-Geschichten",
    description:
      "Personalisierte Gute-Nacht-Geschichten und Audio-Hörspiele, erzählt vom weisen Koala Koda.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={deDE}>
      <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          {children}
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
