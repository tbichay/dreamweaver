/**
 * Berechnet das aktuelle Alter aus einem Geburtsdatum.
 */
export function berechneAlter(geburtsdatum: Date | string): number {
  const geb = typeof geburtsdatum === "string" ? new Date(geburtsdatum) : geburtsdatum;
  const heute = new Date();
  let alter = heute.getFullYear() - geb.getFullYear();
  const m = heute.getMonth() - geb.getMonth();
  if (m < 0 || (m === 0 && heute.getDate() < geb.getDate())) {
    alter--;
  }
  return Math.max(0, alter);
}

/**
 * Gibt altersbasierte Interessen-Vorschläge zurück.
 */
export function getInteressenFuerAlter(alter: number): string[] {
  const basis = ["Tiere", "Natur", "Musik"];

  if (alter <= 3) {
    return [...basis, "Kuscheltiere", "Singen", "Farben", "Schlafen"];
  }
  if (alter <= 6) {
    return [...basis, "Dinosaurier", "Prinzessinnen", "Ritter", "Fahrzeuge", "Malen", "Meerjungfrauen"];
  }
  if (alter <= 10) {
    return [...basis, "Dinosaurier", "Weltraum", "Sport", "Kochen", "Bauen", "Magie", "Superhelden", "Ozean"];
  }
  if (alter <= 14) {
    return [...basis, "Weltraum", "Sport", "Technik", "Wissenschaft", "Freundschaft", "Gerechtigkeit", "Magie"];
  }
  // 14+
  return [...basis, "Philosophie", "Psychologie", "Selbstfindung", "Beziehungen", "Kreativität", "Achtsamkeit"];
}

/**
 * Gibt altersbasierte Charakter-Vorschläge zurück.
 */
export function getCharakterFuerAlter(alter: number): string[] {
  const basis = ["neugierig", "kreativ", "hilfsbereit", "sensibel"];

  if (alter <= 6) {
    return [...basis, "schüchtern", "mutig", "verspielt", "anhänglich", "fröhlich"];
  }
  if (alter <= 12) {
    return [...basis, "schüchtern", "mutig", "abenteuerlustig", "witzig", "nachdenklich", "energiegeladen"];
  }
  if (alter <= 17) {
    return [...basis, "introvertiert", "ehrgeizig", "empathisch", "nachdenklich", "idealistisch", "selbstkritisch"];
  }
  // 18+
  return [...basis, "introvertiert", "reflektiert", "empathisch", "perfektionistisch", "gestresst", "suchend"];
}
