import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum — KoalaTree",
  description: "Impressum und Anbieterkennzeichnung von KoalaTree",
};

export default function ImpressumPage() {
  return (
    <main className="min-h-screen py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-[#a8d5b8] hover:text-[#c8e5d0] transition-colors text-sm mb-8 inline-block"
        >
          &larr; Zur Startseite
        </Link>

        <h1 className="text-4xl font-bold mb-8 text-[#f5eed6]">Impressum</h1>

        <div className="card p-8 space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Angaben gemäß § 5 TMG
            </h2>
            <p className="text-white/70 leading-relaxed">
              [FIRMENNAME]
              <br />
              [STRASSE]
              <br />
              [PLZ ORT]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">Kontakt</h2>
            <p className="text-white/70 leading-relaxed">
              E-Mail: [EMAIL]
              <br />
              Telefon: [TELEFON]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
            </h2>
            <p className="text-white/70 leading-relaxed">
              [FIRMENNAME]
              <br />
              [STRASSE]
              <br />
              [PLZ ORT]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Haftungsausschluss
            </h2>
            <p className="text-white/70 leading-relaxed">
              Die Inhalte dieser Webseite wurden mit größter Sorgfalt erstellt.
              Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
              können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind
              wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach
              den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind
              wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
              gespeicherte fremde Informationen zu überwachen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Streitschlichtung
            </h2>
            <p className="text-white/70 leading-relaxed">
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a8d5b8] hover:text-[#c8e5d0] transition-colors underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>
              . Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
              teilzunehmen.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
