/**
 * Migration Script: Clerk → Auth.js
 *
 * Erstellt Auth.js User-Records und mappt die alten Clerk-IDs
 * in HoererProfil und Geschichte auf die neuen Auth.js User-IDs.
 *
 * Usage: npx tsx scripts/migrate-clerk-to-authjs.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Clerk-ID → E-Mail Mapping (aus Clerk API abgefragt)
const CLERK_TO_EMAIL: Record<string, string> = {
  "user_3BoXoNZFRx8S4F3QZ260zqpuGUW": "tom@bichay.de",
  "user_3BuD1tJfvYOm84Eu5VeKd0RWe1P": "roy.bichay@gmail.com",
  // user_3Bm7ot0TnEuz5r7eaXnhiShinjN — unbekannt/gelöscht, wird separat behandelt
};

async function main() {
  console.log("=== Clerk → Auth.js Migration ===\n");

  // 1. Auth.js User-Records erstellen (falls noch nicht vorhanden)
  for (const [clerkId, email] of Object.entries(CLERK_TO_EMAIL)) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`✓ User ${email} existiert bereits (ID: ${existing.id})`);
    } else {
      const user = await prisma.user.create({
        data: {
          email,
          emailVerified: new Date(),
        },
      });
      console.log(`+ User ${email} erstellt (ID: ${user.id})`);
    }
  }

  // 2. Clerk-IDs in HoererProfil updaten
  console.log("\n--- HoererProfil Migration ---");
  for (const [clerkId, email] of Object.entries(CLERK_TO_EMAIL)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;

    const result = await prisma.hoererProfil.updateMany({
      where: { userId: clerkId },
      data: { userId: user.id },
    });
    console.log(`  ${email}: ${result.count} Profile(e) umgemappt`);
  }

  // 3. Clerk-IDs in Geschichte updaten
  console.log("\n--- Geschichte Migration ---");
  for (const [clerkId, email] of Object.entries(CLERK_TO_EMAIL)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;

    const result = await prisma.geschichte.updateMany({
      where: { userId: clerkId },
      data: { userId: user.id },
    });
    console.log(`  ${email}: ${result.count} Geschichte(n) umgemappt`);
  }

  // 4. Verwaiste Records prüfen (unbekannte Clerk-IDs)
  console.log("\n--- Verwaiste Records ---");
  const orphanedProfiles = await prisma.hoererProfil.findMany({
    where: { userId: { startsWith: "user_" } },
    select: { id: true, userId: true, name: true },
  });
  if (orphanedProfiles.length > 0) {
    console.log(`⚠ ${orphanedProfiles.length} Profile mit unbekannter Clerk-ID:`);
    for (const p of orphanedProfiles) {
      console.log(`  - ${p.name} (Clerk-ID: ${p.userId})`);
    }
  } else {
    console.log("✓ Keine verwaisten Profile");
  }

  const orphanedStories = await prisma.geschichte.findMany({
    where: { userId: { startsWith: "user_" } },
    select: { id: true, userId: true, titel: true },
  });
  if (orphanedStories.length > 0) {
    console.log(`⚠ ${orphanedStories.length} Geschichten mit unbekannter Clerk-ID:`);
    for (const s of orphanedStories) {
      console.log(`  - ${s.titel ?? "(ohne Titel)"} (Clerk-ID: ${s.userId})`);
    }
  } else {
    console.log("✓ Keine verwaisten Geschichten");
  }

  console.log("\n=== Migration abgeschlossen ===");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Migration fehlgeschlagen:", e);
  prisma.$disconnect();
  process.exit(1);
});
