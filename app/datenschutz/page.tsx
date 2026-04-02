import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — KoalaTree",
  description:
    "Datenschutzerklärung von KoalaTree gemäß DSGVO — Informationen zur Verarbeitung personenbezogener Daten",
};

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-[#a8d5b8] hover:text-[#c8e5d0] transition-colors text-sm mb-8 inline-block"
        >
          &larr; Zur Startseite
        </Link>

        <h1 className="text-4xl font-bold mb-8 text-[#f5eed6]">
          Datenschutzerklärung
        </h1>

        <div className="card p-8 space-y-8">
          {/* 1. Verantwortliche Stelle */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              1. Verantwortliche Stelle
            </h2>
            <p className="text-white/70 leading-relaxed">
              Verantwortlich für die Datenverarbeitung auf dieser Webseite ist:
            </p>
            <p className="text-white/70 leading-relaxed mt-2">
              [FIRMENNAME]
              <br />
              [STRASSE]
              <br />
              [PLZ ORT]
              <br />
              E-Mail: [EMAIL]
            </p>
          </section>

          {/* 2. Welche Daten werden erhoben */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              2. Welche Daten werden erhoben
            </h2>
            <p className="text-white/70 leading-relaxed mb-3">
              Im Rahmen der Nutzung von KoalaTree werden folgende
              personenbezogene Daten erhoben und verarbeitet:
            </p>

            <h3 className="text-lg font-semibold mb-2 text-[#f5eed6]">
              2.1 Kontodaten (über Clerk)
            </h3>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2 mb-4">
              <li>Name</li>
              <li>E-Mail-Adresse</li>
              <li>
                Authentifizierungsdaten (Passwort-Hash, OAuth-Token bei
                Social-Login)
              </li>
            </ul>

            <h3 className="text-lg font-semibold mb-2 text-[#f5eed6]">
              2.2 Hörer-Profile
            </h3>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2 mb-4">
              <li>Name des Hörers</li>
              <li>Geburtsdatum bzw. Alter</li>
              <li>Interessen und Vorlieben</li>
              <li>Persönlichkeitsmerkmale (freiwillige Angabe)</li>
              <li>Pädagogische Ziele (freiwillige Angabe)</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2 text-[#f5eed6]">
              2.3 Generierte Inhalte
            </h3>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2 mb-4">
              <li>Texte der generierten Geschichten</li>
              <li>Audio-Dateien der Hörspiele</li>
              <li>
                Einstellungen zur Geschichtenerstellung (Genre, Thema, Erzähler)
              </li>
            </ul>

            <h3 className="text-lg font-semibold mb-2 text-[#f5eed6]">
              2.4 Technische Daten
            </h3>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2">
              <li>IP-Adresse (anonymisiert in Server-Logs)</li>
              <li>Browsertyp und -version</li>
              <li>Zeitpunkt des Zugriffs</li>
            </ul>
          </section>

          {/* 3. Zweck der Datenverarbeitung */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              3. Zweck der Datenverarbeitung
            </h2>
            <p className="text-white/70 leading-relaxed">
              Die erhobenen Daten werden ausschließlich für folgende Zwecke
              verwendet:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2 mt-2">
              <li>
                Bereitstellung des Dienstes: Erstellung personalisierter,
                KI-generierter Geschichten und Audio-Hörspiele
              </li>
              <li>
                Personalisierung: Anpassung der Geschichten an Alter,
                Interessen und pädagogische Ziele des Hörers
              </li>
              <li>
                Kontoverwaltung: Registrierung, Anmeldung und Verwaltung des
                Benutzerkontos
              </li>
              <li>
                Verbesserung des Dienstes: Analyse anonymisierter
                Nutzungsmuster zur Weiterentwicklung
              </li>
            </ul>
          </section>

          {/* 4. Rechtsgrundlage */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              4. Rechtsgrundlage
            </h2>
            <p className="text-white/70 leading-relaxed">
              Die Verarbeitung personenbezogener Daten erfolgt auf Grundlage
              von:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-2 ml-2 mt-2">
              <li>
                <strong className="text-[#f5eed6]">
                  Art. 6 Abs. 1 lit. a DSGVO (Einwilligung):
                </strong>{" "}
                Der Nutzer willigt bei der Registrierung in die Verarbeitung
                seiner Daten ein.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung):
                </strong>{" "}
                Die Datenverarbeitung ist zur Erfüllung des Nutzungsvertrags
                (Erstellung personalisierter Geschichten) erforderlich.
              </li>
            </ul>
          </section>

          {/* 5. Daten von Kindern */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              5. Daten von Kindern (DSGVO Art. 8)
            </h2>
            <p className="text-white/70 leading-relaxed mb-3">
              KoalaTree erstellt personalisierte Geschichten für Kinder. Dabei
              werden Daten zu Kindern (Name, Alter, Interessen) verarbeitet.
            </p>
            <p className="text-white/70 leading-relaxed mb-3">
              <strong className="text-[#f5eed6]">
                Die Einwilligung der Eltern bzw. Erziehungsberechtigten ist
                zwingend erforderlich.
              </strong>{" "}
              Die Registrierung und Erstellung von Hörer-Profilen für
              Minderjährige darf ausschließlich durch einen
              Erziehungsberechtigten erfolgen. Mit der Erstellung eines
              Hörer-Profils für ein Kind bestätigt der registrierte Nutzer, dass
              er erziehungsberechtigt ist und der Verarbeitung der Daten des
              Kindes zustimmt.
            </p>
            <p className="text-white/70 leading-relaxed">
              Die Daten der Kinder werden ausschließlich zur Personalisierung
              der Geschichten verwendet und nicht an Dritte zu Werbezwecken
              weitergegeben.
            </p>
          </section>

          {/* 6. Drittanbieter */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              6. Weitergabe an Drittanbieter
            </h2>
            <p className="text-white/70 leading-relaxed mb-4">
              Zur Erbringung unseres Dienstes arbeiten wir mit folgenden
              Drittanbietern zusammen:
            </p>

            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-[#f5eed6] mb-1">
                  Clerk (clerk.com) — Authentifizierung
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Verarbeitet: E-Mail, Name, Passwort-Hash, Session-Daten.
                  Standort: USA. Rechtsgrundlage für Drittlandtransfer:
                  EU-Standardvertragsklauseln (SCCs).
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-[#f5eed6] mb-1">
                  Anthropic (anthropic.com) — KI-Generierung
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Verarbeitet: Hörer-Profildaten (Name, Alter, Interessen) und
                  Geschichtenparameter zur Generierung der personalisierten
                  Geschichten. Standort: USA. Rechtsgrundlage:
                  EU-Standardvertragsklauseln (SCCs).
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-[#f5eed6] mb-1">
                  ElevenLabs (elevenlabs.io) — Text-to-Speech
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Verarbeitet: Generierte Geschichtentexte zur Umwandlung in
                  Audio. Standort: USA/EU. Rechtsgrundlage:
                  EU-Standardvertragsklauseln (SCCs).
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-[#f5eed6] mb-1">
                  Vercel (vercel.com) — Hosting & Blob Storage
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Verarbeitet: Webseiten-Hosting, Speicherung von Audio-Dateien
                  (Vercel Blob), Server-Logs. Standort: Global Edge Network.
                  Rechtsgrundlage: EU-Standardvertragsklauseln (SCCs).
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="font-semibold text-[#f5eed6] mb-1">
                  Neon (neon.tech) — PostgreSQL-Datenbank
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Verarbeitet: Alle Benutzerdaten, Hörer-Profile, Geschichten
                  und Metadaten. Standort: EU (Frankfurt). Rechtsgrundlage:
                  Verarbeitung innerhalb der EU.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Cookies */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              7. Cookies
            </h2>
            <p className="text-white/70 leading-relaxed">
              KoalaTree verwendet ausschließlich technisch notwendige
              Session-Cookies, die für die Authentifizierung über Clerk
              erforderlich sind. Es werden keine Tracking-, Analyse- oder
              Werbe-Cookies eingesetzt. Die Session-Cookies werden nach
              Beendigung der Browsersitzung bzw. nach Ablauf der Sitzungsdauer
              automatisch gelöscht.
            </p>
          </section>

          {/* 8. Rechte der Betroffenen */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              8. Rechte der Betroffenen
            </h2>
            <p className="text-white/70 leading-relaxed mb-3">
              Sie haben gemäß DSGVO folgende Rechte bezüglich Ihrer
              personenbezogenen Daten:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-2 ml-2">
              <li>
                <strong className="text-[#f5eed6]">
                  Recht auf Auskunft (Art. 15 DSGVO):
                </strong>{" "}
                Sie können Auskunft über die von uns verarbeiteten Daten
                verlangen.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Recht auf Berichtigung (Art. 16 DSGVO):
                </strong>{" "}
                Sie können die Berichtigung unrichtiger Daten verlangen.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Recht auf Löschung (Art. 17 DSGVO):
                </strong>{" "}
                Sie können die Löschung Ihrer Daten verlangen. Die Kontolöschung
                kann direkt in den Kontoeinstellungen durchgeführt werden.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Recht auf Einschränkung (Art. 18 DSGVO):
                </strong>{" "}
                Sie können die Einschränkung der Verarbeitung verlangen.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Recht auf Datenübertragbarkeit (Art. 20 DSGVO):
                </strong>{" "}
                Sie können Ihre Daten in einem strukturierten, gängigen und
                maschinenlesbaren Format erhalten.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Widerspruchsrecht (Art. 21 DSGVO):
                </strong>{" "}
                Sie können der Verarbeitung Ihrer Daten jederzeit widersprechen.
              </li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-3">
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an: [EMAIL]
            </p>
          </section>

          {/* 9. Speicherdauer */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              9. Speicherdauer
            </h2>
            <p className="text-white/70 leading-relaxed">
              Personenbezogene Daten werden nur so lange gespeichert, wie es für
              die Erfüllung des Vertragszwecks erforderlich ist. Bei Löschung
              des Benutzerkontos werden sämtliche personenbezogene Daten,
              Hörer-Profile, generierte Geschichten und Audio-Dateien
              unwiderruflich gelöscht. Server-Logs mit anonymisierten IP-Adressen
              werden nach 30 Tagen automatisch gelöscht.
            </p>
          </section>

          {/* 10. Datensicherheit */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              10. Datensicherheit
            </h2>
            <p className="text-white/70 leading-relaxed">
              Wir setzen technische und organisatorische Maßnahmen ein, um Ihre
              Daten zu schützen:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2 mt-2">
              <li>
                Verschlüsselte Datenübertragung mittels HTTPS/TLS
              </li>
              <li>
                Verschlüsselte Datenbank (Neon PostgreSQL mit Encryption at Rest)
              </li>
              <li>
                Zugriffsbeschränkung auf personenbezogene Daten
              </li>
              <li>
                Regelmäßige Sicherheitsüberprüfungen
              </li>
            </ul>
          </section>

          {/* 11. Beschwerderecht */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              11. Beschwerderecht bei der Aufsichtsbehörde
            </h2>
            <p className="text-white/70 leading-relaxed">
              Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer
              personenbezogenen Daten gegen die DSGVO verstößt, haben Sie das
              Recht, eine Beschwerde bei einer Datenschutz-Aufsichtsbehörde
              einzureichen. Zuständig ist die Aufsichtsbehörde des
              Bundeslandes, in dem Sie Ihren Wohnsitz haben, oder die Behörde
              am Sitz des Anbieters.
            </p>
          </section>

          <p className="text-white/40 text-sm pt-4 border-t border-white/10">
            Stand: April 2026
          </p>
        </div>
      </div>
    </main>
  );
}
