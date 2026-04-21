/**
 * Validation-Check fuer Unification Phase 2.
 *
 * - Jeder DigitalActor hat ein actorId (oder erwartbar null, dokumentieren)
 * - Jeder Actor, der als Bridge existiert (digitalActorAliases has some),
 *   hat mind. einen gueltigen FK-Back-Reference
 * - Kein StudioCharacter hat eine kaputte Referenz
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const totalDA = await prisma.digitalActor.count();
  const withActorId = await prisma.digitalActor.count({
    where: { actorId: { not: null } },
  });
  const withoutActorId = totalDA - withActorId;

  const totalActors = await prisma.actor.count();
  const actorsWithDAs = await prisma.actor.count({
    where: { digitalActorAliases: { some: {} } },
  });
  const systemActors = await prisma.actor.count({
    where: { ownerUserId: null },
  });
  const userActors = totalActors - systemActors;

  const orphanCharacters = await prisma.studioCharacter.count({
    where: {
      AND: [
        { actorId: { not: null } },
        { actor: null }, // FK broken
      ],
    },
  });

  console.log("\n=== Unification Status ===");
  console.log(`DigitalActors:                    ${totalDA}`);
  console.log(`  with actorId (migrated):        ${withActorId}`);
  console.log(`  without actorId:                ${withoutActorId}`);
  console.log(`\nActors total:                     ${totalActors}`);
  console.log(`  system (ownerUserId=null):      ${systemActors}`);
  console.log(`  user-owned:                     ${userActors}`);
  console.log(`  with DigitalActor-Alias:        ${actorsWithDAs}`);
  console.log(`\nStudioCharacters with broken FK:  ${orphanCharacters}`);
  console.log();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
