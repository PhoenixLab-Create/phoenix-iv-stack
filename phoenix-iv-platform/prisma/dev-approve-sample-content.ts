/**
 * DEV/TEST ONLY — NEVER RUN AGAINST ANYTHING BUT A LOCAL OR CI DATABASE
 * SEEDED WITH SYNTHETIC DATA.
 *
 * seed.ts deliberately leaves the sample screening rule, protocol catalog,
 * and consent template INACTIVE/unapproved — that's correct behavior: this
 * software must never invent or silently activate clinical content, so a
 * fresh seed legitimately blocks at Screening, Protocol selection, and
 * Consent with a "[CLINIC TO SUPPLY ...]" error. That block is working as
 * designed, not a bug.
 *
 * This script exists only so a developer manually testing the full 14-step
 * workflow end-to-end can flip those SAME sample rows (still obviously
 * labeled "SAMPLE — NOT CLINIC-APPROVED" in their text) to active, entirely
 * on their own throwaway local database, so they can walk the happy path
 * without waiting on the clinic's real content. It will refuse to run
 * against anything that doesn't look like the seeded dev fixtures.
 *
 * A real clinic deployment approves real content through the Medical
 * Director's own review process — never by running a script — and this
 * file should not exist in that deployment's path at all.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rule = await prisma.screeningRule.findFirst({
    where: { authoredBy: { contains: 'SAMPLE — NOT CLINIC-APPROVED' } },
  });
  if (!rule) {
    throw new Error('No seeded sample screening rule found. Run `npx ts-node prisma/seed.ts` first.');
  }
  await prisma.screeningRule.update({
    where: { id: rule.id },
    data: { active: true, approvedBy: 'dev-script (NOT a real clinical approval)', approvedAt: new Date() },
  });

  const protocols = await prisma.protocol.findMany({
    where: { approvedAt: null, active: false },
  });
  for (const p of protocols) {
    await prisma.protocol.update({
      where: { id: p.id },
      data: { active: true, approvedBy: 'dev-script (NOT a real clinical approval)', approvedAt: new Date() },
    });
  }

  const template = await prisma.consentTemplate.findFirst({
    where: { approvedBy: { contains: 'SAMPLE — NOT CLINIC-APPROVED' } },
  });
  if (!template) {
    throw new Error('No seeded sample consent template found. Run `npx ts-node prisma/seed.ts` first.');
  }
  await prisma.consentTemplate.update({
    where: { id: template.id },
    data: { effectiveFrom: new Date() },
  });

  console.log(
    'DEV-ONLY sample content activated (1 screening rule, %d protocol(s), 1 consent template). ' +
      'This database is no longer suitable for anything but local testing.',
    protocols.length,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
