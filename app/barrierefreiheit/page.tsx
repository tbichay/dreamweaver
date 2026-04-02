import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Barrierefreiheit — KoalaTree",
  description:
    "Erklärung zur Barrierefreiheit von KoalaTree gemäß BFSG und BITV 2.0",
};

export default function BarrierefreiheitPage() {
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
          Erklärung zur Barrierefreiheit
        </h1>

        <div className="card p-8 space-y-8">
          {/* Einleitung */}
          <section>
            <p className="text-white/70 leading-relaxed">
              KoalaTree ist bestrebt, seine Webseite und mobilen Anwendungen
              gemäß dem Barrierefreiheitsstärkungsgesetz (BFSG) und der
              Barrierefreie-Informationstechnik-Verordnung (BITV 2.0) in
              Verbindung mit den Web Content Accessibility Guidelines (WCAG) 2.1
              barrierefrei zugänglich zu machen.
            </p>
          </section>

          {/* Stand der Konformität */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Stand der Konformität
            </h2>
            <p className="text-white/70 leading-relaxed">
              Diese Webseite ist{" "}
              <strong className="text-[#f5eed6]">teilweise konform</strong> mit
              den Anforderungen der BITV 2.0 und WCAG 2.1 Level AA. Die
              nachfolgend aufgeführten Inhalte sind nicht vollständig
              barrierefrei.
            </p>
          </section>

          {/* Bekannte Einschränkungen */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Bekannte Einschränkungen
            </h2>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-3 ml-2">
              <li>
                <strong className="text-[#f5eed6]">
                  KI-generierte Audio-Inhalte:
                </strong>{" "}
                Die automatisch generierten Audio-Hörspiele verfügen derzeit
                nicht über Untertitel oder Transkripte. Die zugehörigen
                Geschichtentexte stehen jedoch als schriftliche Alternative zur
                Verfügung.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  KI-generierte Textinhalte:
                </strong>{" "}
                Da Geschichten dynamisch durch Künstliche Intelligenz erstellt
                werden, kann die semantische Strukturierung der Texte
                variieren.
              </li>
              <li>
                <strong className="text-[#f5eed6]">
                  Kontraste bei dekorativen Elementen:
                </strong>{" "}
                Einige dekorative Hintergrundelemente (Sterne, Glühwürmchen)
                erfüllen möglicherweise nicht die Mindestkontrastverhältnisse,
                sind jedoch rein dekorativ und nicht inhaltsrelevant.
              </li>
            </ul>
          </section>

          {/* Maßnahmen */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Maßnahmen zur Verbesserung
            </h2>
            <p className="text-white/70 leading-relaxed">
              Wir arbeiten kontinuierlich an der Verbesserung der
              Barrierefreiheit. Geplante Maßnahmen umfassen:
            </p>
            <ul className="list-disc list-inside text-white/70 leading-relaxed space-y-1 ml-2 mt-2">
              <li>
                Bereitstellung von Transkripten für Audio-Inhalte
              </li>
              <li>
                Regelmäßige Überprüfung der Barrierefreiheit durch automatisierte
                und manuelle Tests
              </li>
              <li>
                Verbesserung der Tastaturnavigation im Audio-Player
              </li>
            </ul>
          </section>

          {/* Feedback */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Feedback und Kontakt
            </h2>
            <p className="text-white/70 leading-relaxed">
              Wenn Sie Barrieren auf unserer Webseite feststellen oder
              Verbesserungsvorschläge haben, kontaktieren Sie uns bitte:
            </p>
            <p className="text-white/70 leading-relaxed mt-2">
              E-Mail:{" "}
              <a
                href="mailto:[BARRIEREFREIHEIT-EMAIL]"
                className="text-[#a8d5b8] hover:text-[#c8e5d0] transition-colors underline"
              >
                [BARRIEREFREIHEIT-EMAIL]
              </a>
            </p>
            <p className="text-white/70 leading-relaxed mt-2">
              Wir werden Ihre Anfrage innerhalb von zwei Wochen bearbeiten und
              bemühen uns, festgestellte Mängel zeitnah zu beheben.
            </p>
          </section>

          {/* Durchsetzungsverfahren */}
          <section>
            <h2 className="text-xl font-bold mb-3 text-[#d4a853]">
              Durchsetzungsverfahren
            </h2>
            <p className="text-white/70 leading-relaxed">
              Sollte eine zufriedenstellende Lösung nach Ihrer Kontaktaufnahme
              nicht möglich sein, können Sie sich an die zuständige
              Schlichtungsstelle wenden. Die Schlichtungsstelle nach § 16 BGG
              hat die Aufgabe, bei Konflikten zum Thema Barrierefreiheit
              zwischen Menschen mit Behinderungen und öffentlichen Stellen des
              Bundes eine außergerichtliche Streitbeilegung zu unterstützen.
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
