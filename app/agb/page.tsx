import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AGB — KoalaTree",
  description:
    "Allgemeine Geschäftsbedingungen von KoalaTree für KI-generierte personalisierte Geschichten",
};

export default function AGBPage() {
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
          Allgemeine Geschäftsbedingungen (AGB)
        </h1>

        <div className="card p-8 space-y-8">
          {/* 1. Geltungsbereich */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              1. Geltungsbereich
            </h2>
            <p className="text-white/70 leading-relaxed">
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der
              Plattform KoalaTree (nachfolgend &quot;Dienst&quot;), betrieben von
              [FIRMENNAME], [STRASSE], [PLZ ORT] (nachfolgend
              &quot;Anbieter&quot;). Der Dienst ermöglicht die Erstellung
              KI-generierter, personalisierter Geschichten und Audio-Hörspiele
              für Kinder und Erwachsene.
            </p>
          </section>

          {/* 2. Vertragsschluss */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              2. Vertragsschluss
            </h2>
            <p className="text-white/70 leading-relaxed">
              Der Vertrag zwischen Nutzer und Anbieter kommt durch die
              Registrierung eines Benutzerkontos zustande. Mit der Registrierung
              erklärt der Nutzer sein Einverständnis mit diesen AGB. Die
              Registrierung ist nur volljährigen Personen gestattet. Für die
              Nutzung des Dienstes durch Minderjährige ist die Einwilligung
              eines Erziehungsberechtigten erforderlich.
            </p>
          </section>

          {/* 3. Leistungsbeschreibung */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              3. Leistungsbeschreibung
            </h2>
            <p className="text-white/70 leading-relaxed mb-3">
              KoalaTree bietet folgende Leistungen:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-2 ml-2">
              <li>
                Erstellung personalisierter Geschichten mittels Künstlicher
                Intelligenz (KI), basierend auf den vom Nutzer bereitgestellten
                Profildaten (Name, Alter, Interessen, pädagogische Ziele)
              </li>
              <li>
                Generierung von Audio-Hörspielen der erstellten Geschichten
                mittels Text-to-Speech-Technologie
              </li>
              <li>
                Speicherung und Verwaltung von Hörer-Profilen und generierten
                Geschichten im Benutzerkonto
              </li>
            </ul>
          </section>

          {/* 4. Haftungsausschluss */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              4. Haftungsausschluss für KI-generierte Inhalte
            </h2>
            <p className="text-white/70 leading-relaxed mb-3">
              Die über KoalaTree generierten Geschichten und Audio-Inhalte werden
              vollständig durch Künstliche Intelligenz erstellt. Der Anbieter
              weist ausdrücklich darauf hin:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-2 ml-2">
              <li>
                KI-generierte Inhalte können trotz sorgfältiger Konfiguration
                unerwartete oder unpassende Formulierungen enthalten.
              </li>
              <li>
                Der Anbieter übernimmt keine Garantie für die pädagogische
                Eignung oder Altersangemessenheit der generierten Inhalte.
              </li>
              <li>
                Die Inhalte ersetzen keine professionelle pädagogische,
                psychologische oder therapeutische Beratung.
              </li>
              <li>
                Der Anbieter empfiehlt Erziehungsberechtigten, die generierten
                Inhalte vor der Wiedergabe an Kinder zu überprüfen.
              </li>
            </ul>
          </section>

          {/* 5. Nutzungsrechte */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              5. Nutzungsrechte an generierten Inhalten
            </h2>
            <p className="text-white/70 leading-relaxed">
              Der Nutzer behält sämtliche Nutzungsrechte an den für ihn
              generierten Geschichten und Audio-Inhalten. Der Nutzer darf die
              Inhalte für den persönlichen, nicht-kommerziellen Gebrauch frei
              verwenden, speichern und teilen. Der Anbieter behält sich das
              Recht vor, anonymisierte und nicht personenbezogene Daten zur
              Verbesserung des Dienstes zu verwenden.
            </p>
          </section>

          {/* 6. Datenschutz */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              6. Datenschutz
            </h2>
            <p className="text-white/70 leading-relaxed">
              Die Erhebung und Verarbeitung personenbezogener Daten erfolgt
              gemäß unserer{" "}
              <Link
                href="/datenschutz"
                className="text-[#a8d5b8] hover:text-[#c8e5d0] transition-colors underline"
              >
                Datenschutzerklärung
              </Link>
              . Der Nutzer erklärt sich mit der Datenverarbeitung im dort
              beschriebenen Umfang einverstanden.
            </p>
          </section>

          {/* 7. Kündigung */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              7. Kündigung und Kontolöschung
            </h2>
            <p className="text-white/70 leading-relaxed">
              Der Nutzer kann sein Konto jederzeit und ohne Angabe von Gründen
              löschen. Die Löschung des Kontos führt zur unwiderruflichen
              Entfernung aller gespeicherten Daten, einschließlich Hörer-Profile,
              generierter Geschichten und Audio-Dateien. Der Anbieter behält sich
              das Recht vor, Benutzerkonten bei Verstoß gegen diese AGB zu
              sperren oder zu löschen.
            </p>
          </section>

          {/* 8. Schlussbestimmungen */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              8. Schlussbestimmungen
            </h2>
            <p className="text-white/70 leading-relaxed mb-3">
              Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne
              Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der
              übrigen Bestimmungen davon unberührt. Der Anbieter behält sich vor,
              diese AGB jederzeit zu ändern. Über Änderungen wird der Nutzer per
              E-Mail informiert.
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
