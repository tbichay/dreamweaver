import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { deDE } from "@clerk/localizations";
import Providers from "./components/Providers";
import CookieBanner from "./components/CookieBanner";
import InstallPrompt from "./components/InstallPrompt";
import ServiceWorker from "./components/ServiceWorker";
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
    <ClerkProvider
      localization={deDE}
      appearance={{
        variables: {
          colorPrimary: "#4a7c59",
          colorText: "#f5eed6",
          colorTextSecondary: "rgba(245,238,214,0.65)",
          colorBackground: "#1f3a1f",
          colorInputBackground: "rgba(255,255,255,0.08)",
          colorInputText: "#f5eed6",
          colorDanger: "#ef4444",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-geist-sans), sans-serif",
        },
        elements: {
          // ── Sign-in / Sign-up card ──
          card: {
            backgroundColor: "rgba(26, 46, 26, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          },
          headerTitle: { color: "#f5eed6" },
          headerSubtitle: { color: "rgba(245,238,214,0.6)" },
          formFieldLabel: { color: "rgba(245,238,214,0.85)" },
          formFieldInput: {
            backgroundColor: "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.15)",
            color: "#f5eed6",
          },
          formFieldHintText: { color: "rgba(245,238,214,0.5)" },
          formFieldInfoText: { color: "rgba(245,238,214,0.5)" },
          formFieldWarningText: { color: "#f4c078" },
          formFieldErrorText: { color: "#ef4444" },
          formFieldSuccessText: { color: "#a8d5b8" },
          formFieldAction: { color: "#a8d5b8" },
          formFieldInputPlaceholder: { color: "rgba(245,238,214,0.3)" },
          formButtonPrimary: {
            background: "linear-gradient(135deg, #4a7c59, #3d6b4a)",
            color: "#f5eed6",
            fontWeight: "600",
            boxShadow: "0 4px 16px rgba(61,107,74,0.3)",
          },
          formButtonReset: {
            color: "rgba(245,238,214,0.6)",
          },
          formHeaderTitle: { color: "#f5eed6" },
          formHeaderSubtitle: { color: "rgba(245,238,214,0.6)" },
          footerActionLink: { color: "#a8d5b8" },
          footerActionText: { color: "rgba(245,238,214,0.5)" },
          footerText: { color: "rgba(245,238,214,0.4)" },
          footerPages: { color: "rgba(245,238,214,0.4)" },
          footerPagesLink: { color: "rgba(245,238,214,0.5)" },
          dividerLine: { backgroundColor: "rgba(255,255,255,0.1)" },
          dividerText: { color: "rgba(245,238,214,0.4)" },
          socialButtonsBlockButton: {
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.12)",
            color: "#f5eed6",
          },
          socialButtonsBlockButtonText: { color: "#f5eed6" },
          identityPreview: {
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
          },
          identityPreviewText: { color: "#f5eed6" },
          identityPreviewEditButton: { color: "#a8d5b8" },
          identityPreviewEditButtonIcon: { color: "#a8d5b8" },
          otpCodeFieldInput: {
            backgroundColor: "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.15)",
            color: "#f5eed6",
          },
          // ── User Button Popover ──
          userButtonPopoverCard: {
            backgroundColor: "#1a2e1a",
            borderColor: "rgba(255,255,255,0.1)",
          },
          userButtonPopoverActionButton: { color: "#f5eed6" },
          userButtonPopoverActionButtonText: { color: "#f5eed6" },
          userButtonPopoverActionButtonIcon: { color: "rgba(245,238,214,0.6)" },
          userButtonPopoverFooter: {
            borderColor: "rgba(255,255,255,0.1)",
          },
          // ── Account/Profile Modal — full dark theme ──
          modalContent: {
            backgroundColor: "#1a2e1a",
          },
          modalBackdrop: {
            backgroundColor: "rgba(0,0,0,0.7)",
          },
          modalCloseButton: {
            color: "rgba(245,238,214,0.6)",
          },
          // ── Navbar (left sidebar) ──
          navbar: {
            backgroundColor: "#162816",
            borderColor: "rgba(255,255,255,0.1)",
          },
          navbarButton: {
            color: "#f5eed6",
          },
          navbarButtonIcon: {
            color: "rgba(245,238,214,0.6)",
          },
          navbarMobileMenuButton: {
            color: "#f5eed6",
          },
          // ── Page / Content Area ──
          pageScrollBox: {
            backgroundColor: "#1a2e1a",
          },
          page: {
            backgroundColor: "#1a2e1a",
          },
          // ── Profile sections ──
          profileSection: {
            borderColor: "rgba(255,255,255,0.1)",
          },
          profileSectionTitle: {
            color: "#f5eed6",
            borderColor: "rgba(255,255,255,0.1)",
          },
          profileSectionTitleText: {
            color: "#f5eed6",
          },
          profileSectionContent: {
            color: "rgba(245,238,214,0.8)",
          },
          profileSectionPrimaryButton: {
            color: "#a8d5b8",
          },
          profileSectionItemList: {
            color: "#f5eed6",
          },
          // ── Profile page specific ──
          userProfile: {
            color: "#f5eed6",
          },
          profilePage: {
            color: "#f5eed6",
          },
          // ── Avatar / Upload ──
          avatarBox: {
            color: "#f5eed6",
          },
          avatarImageActionsUpload: {
            color: "#a8d5b8",
          },
          avatarImageActionsRemove: {
            color: "rgba(245,238,214,0.5)",
          },
          fileDropAreaBox: {
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.15)",
          },
          fileDropAreaIconBox: {
            color: "rgba(245,238,214,0.4)",
          },
          fileDropAreaHint: {
            color: "rgba(245,238,214,0.5)",
          },
          fileDropAreaFooterHint: {
            color: "rgba(245,238,214,0.4)",
          },
          // ── Accordion (expandable sections) ──
          accordionTriggerButton: {
            color: "#f5eed6",
          },
          accordionContent: {
            backgroundColor: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.1)",
          },
          // ── Badges ──
          badge: {
            backgroundColor: "rgba(74,124,89,0.3)",
            color: "#a8d5b8",
            borderColor: "rgba(74,124,89,0.5)",
          },
          // ── Menus / Dropdowns ──
          menuButton: {
            color: "rgba(245,238,214,0.6)",
          },
          menuList: {
            backgroundColor: "#1a2e1a",
            borderColor: "rgba(255,255,255,0.1)",
          },
          menuItem: {
            color: "#f5eed6",
          },
          // ── Alert / Notification ──
          alertText: {
            color: "#f5eed6",
          },
          alert: {
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
            color: "#f5eed6",
          },
          // ── Tags ──
          tagInputContainer: {
            backgroundColor: "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.15)",
          },
          tagPillContainer: {
            backgroundColor: "rgba(74,124,89,0.3)",
            color: "#a8d5b8",
          },
          // ── Generic text and button catch-alls ──
          text: { color: "#f5eed6" },
          label: { color: "rgba(245,238,214,0.85)" },
          buttonArrowIcon: { color: "rgba(245,238,214,0.6)" },
          selectButton: {
            backgroundColor: "rgba(255,255,255,0.08)",
            borderColor: "rgba(255,255,255,0.15)",
            color: "#f5eed6",
          },
          selectOptionsContainer: {
            backgroundColor: "#1a2e1a",
            borderColor: "rgba(255,255,255,0.1)",
          },
          selectOption: {
            color: "#f5eed6",
          },
          // ── Internal / Table elements ──
          tableHead: { color: "rgba(245,238,214,0.6)" },
          tableBody: { color: "#f5eed6" },
          // ── Breadcrumbs ──
          breadcrumbs: { color: "rgba(245,238,214,0.5)" },
          breadcrumbsItem: { color: "rgba(245,238,214,0.5)" },
          breadcrumbsItemDivider: { color: "rgba(245,238,214,0.3)" },
        },
      }}
    >
      <html lang="de" className={`${geistSans.variable} h-full antialiased`}>
        <head>
          <meta name="theme-color" content="#1a2e1a" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="KoalaTree" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        </head>
        <body className="min-h-full flex flex-col">
          <Providers>
            {children}
          </Providers>
          <CookieBanner />
          <InstallPrompt />
          <ServiceWorker />
        </body>
      </html>
    </ClerkProvider>
  );
}
