/**
 * Seeds roles + permissions + the admin_clinical_visibility default, and one
 * synthetic test user per role for local/CI use. NEVER run against a
 * production database with real patient data — this is dev/test fixture data.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'patient.register', 'patient.search',
  'visit.start', 'visit.view.status', 'visit.view.clinical',
  'assessment.record', 'order.record', 'protocol.select', 'intake.record',
  'screening.acknowledge',
  'consent.witness', 'prep.record', 'insertion.record', 'monitoring.record',
  'adverse_event.record', 'completion.record', 'visit.sign',
  'amendment.create', 'amendment.approve',
  'settings.manage', 'user.manage', 'audit.view', 'break_glass.use',
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  NURSE_CLINICIAN: [
    'visit.start', 'visit.view.clinical', 'assessment.record', 'order.record',
    'protocol.select', 'intake.record',
    'screening.acknowledge', 'consent.witness', 'prep.record', 'insertion.record',
    'monitoring.record', 'adverse_event.record', 'completion.record', 'visit.sign',
    'amendment.create', 'patient.search',
  ],
   'patient.register',
  PRESCRIBER: ['visit.view.clinical', 'order.record', 'amendment.approve', 'patient.search'],
  ADMIN: ['patient.register', 'patient.search', 'visit.start', 'visit.view.status', 'visit.view.clinical'],
  SYSTEM_ADMIN: ['settings.manage', 'user.manage', 'audit.view', 'break_glass.use'],
  MEDICAL_DIRECTOR: ['settings.manage', 'audit.view', 'amendment.approve', 'visit.view.clinical'],
};

async function main() {
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, create: { key, label: key }, update: {} });
  }

  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName as any },
      create: { name: roleName as any },
      update: {},
    });
    for (const permKey of perms) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: 'admin_clinical_visibility' },
    create: { key: 'admin_clinical_visibility', value: { mode: 'full' }, updatedBy: 'seed' },
    update: {},
  });

  // Intake form schema — these questions are taken directly from the PRD
  // (Screen 2: Medical Intake), which the clinic itself specified. This is
  // structural/data-collection content, not a clinical rule or a dose, so it
  // is safe to seed as active. Screening rules, protocols and consent text
  // below remain inactive/unapproved placeholders until the clinic supplies
  // the real clinical content.
  await prisma.formVersion.upsert({
    where: { kind_version: { kind: 'intake', version: 1 } },
    create: {
      kind: 'intake',
      version: 1,
      active: true,
      createdBy: 'seed',
      schema: [
        { key: 'conditions.Heart disease', label: 'Heart disease', type: 'boolean' },
        { key: 'conditions.Kidney disease', label: 'Kidney disease', type: 'boolean' },
        { key: 'conditions.Liver disease', label: 'Liver disease', type: 'boolean' },
        { key: 'conditions.Diabetes', label: 'Diabetes', type: 'boolean' },
        { key: 'conditions.High blood pressure', label: 'High blood pressure', type: 'boolean' },
        { key: 'conditions.Asthma', label: 'Asthma', type: 'boolean' },
        { key: 'conditions.Seizure disorder', label: 'Seizure disorder', type: 'boolean' },
        { key: 'conditions.Bleeding disorder', label: 'Bleeding disorder', type: 'boolean' },
        { key: 'conditions.Cancer', label: 'Cancer', type: 'boolean' },
        { key: 'conditions.Previous serious allergic reaction', label: 'Previous serious allergic reaction', type: 'boolean' },
        { key: 'otherConditions', label: 'Other medical conditions', type: 'text' },
        { key: 'allergyYN', label: 'Do you have any medication, food or other allergies?', type: 'boolean' },
        { key: 'pregnant', label: 'Are you pregnant?', type: 'boolean' },
        { key: 'mightBePregnant', label: 'Could you be pregnant?', type: 'boolean' },
        { key: 'breastfeeding', label: 'Are you breastfeeding?', type: 'boolean' },
        { key: 'priorIV', label: 'Have you received IV vitamin therapy before?', type: 'boolean' },
        { key: 'priorReaction', label: 'Have you ever had a reaction to an IV infusion?', type: 'boolean' },
        { key: 'priorAccessIssue', label: 'Have you ever had difficulty with IV access?', type: 'boolean' },
      ],
    },
    update: {},
  });

  // Sample screening rule — INACTIVE. This is dev/test fixture data only, so
  // CI and local development have something to exercise the rule engine
  // against. It must never be flipped to active in a real environment until
  // the Medical Director has authored and approved real wording.
  await prisma.screeningRule.create({
    data: {
      version: 1,
      active: false,
      approvedAt: null,
      authoredBy: 'seed (SAMPLE — NOT CLINIC-APPROVED)',
      message: 'SAMPLE RULE — placeholder only. Patient reports a heart condition. [CLINIC TO SUPPLY real wording]',
      expression: { field: 'conditions.Heart disease', op: 'truthy' },
    },
  });

  // Sample protocol catalog — INACTIVE/unapproved placeholders, names only
  // from the PRD, no doses (doses are explicitly clinic-supplied).
  const sampleProtocols = [
    { name: 'Phoenix Glow', description: 'Vitamin C + Glutathione + B Complex — [CLINIC TO SUPPLY doses]' },
    { name: 'Phoenix Energy', description: 'B Complex + Magnesium — [CLINIC TO SUPPLY doses]' },
    { name: 'Phoenix Hydration', description: 'Normal Saline + approved multivitamin formulation — [CLINIC TO SUPPLY doses]' },
  ];
  for (const p of sampleProtocols) {
    await prisma.protocol.create({
      data: { version: 1, active: false, approvedAt: null, name: p.name, description: p.description },
    });
  }
  await prisma.protocol.create({
    data: {
      version: 1,
      active: false,
      approvedAt: null,
      isCustom: true,
      name: 'Custom / Other Prescribed Infusion',
      description: 'Ingredients/doses come from the prescriber order, never generated by this software.',
    },
  });

  // Sample consent template — INACTIVE placeholder (effectiveFrom in the
  // future so getActiveTemplate() never resolves it by accident).
  await prisma.consentTemplate.create({
    data: {
      version: 1,
      approvedBy: 'seed (SAMPLE — NOT CLINIC-APPROVED)',
      effectiveFrom: new Date('2999-01-01'),
      body: 'SAMPLE CONSENT TEXT — PLACEHOLDER ONLY. [CLINIC TO SUPPLY final approved consent text for {{patientName}}]',
    },
  });

  // Sample product catalog + lots — TEST FIXTURE DATA ONLY. Unlike
  // screening rules / protocols / consent text, a product/lot record carries
  // no clinical judgment (no dose, no rule) — it's just inventory metadata —
  // so it's safe to seed as active for dev/CI to exercise the prep flow
  // against. Real inventory still must be entered by the clinic before
  // any real visit.
  const saline = await prisma.product.create({
    data: { kind: 'BASE_SOLUTION', name: 'Normal Saline 0.9% (TEST FIXTURE)', active: true },
  });
  await prisma.productLot.create({
    data: { productId: saline.id, lotNumber: 'TEST-SALINE-0001', expiryDate: new Date('2999-01-01') },
  });

  const vitaminC = await prisma.product.create({
    data: { kind: 'INGREDIENT', name: 'Vitamin C (TEST FIXTURE)', active: true },
  });
  await prisma.productLot.create({
    data: { productId: vitaminC.id, lotNumber: 'TEST-VITC-0001', expiryDate: new Date('2999-01-01') },
  });
  // An already-expired lot too, so the expired-lot hard-block path has
  // something real to exercise in manual/dev testing without waiting a year.
  await prisma.productLot.create({
    data: { productId: vitaminC.id, lotNumber: 'TEST-VITC-EXPIRED', expiryDate: new Date('2020-01-01') },
  });

  // Synthetic test users only — password "Test-Password-Only-123" for all, local/CI use.
  const testUsers = [
    { email: 'nurse.test@example.test', first: 'Nurse', last: 'TestAccount', role: 'NURSE_CLINICIAN', designation: 'RN' },
    { email: 'admin.test@example.test', first: 'Admin', last: 'TestAccount', role: 'ADMIN' },
    { email: 'sysadmin.test@example.test', first: 'SysAdmin', last: 'TestAccount', role: 'SYSTEM_ADMIN' },
  ];
  const passwordHash = await argon2.hash('Test-Password-Only-123', { type: argon2.argon2id });

  for (const u of testUsers) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: u.role as any } });
    const created = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        firstName: u.first,
        lastName: u.last,
        email: u.email,
        passwordHash,
        professionalDesignation: (u as any).designation,
        mfaEnrolled: false,
        // Every user needs a TOTP secret from creation so the first login can
        // hand back the authenticator-app enrollment step (matches what
        // UsersService.create does for users made through the app).
        mfaSecretEncrypted: authenticator.generateSecret(),
        roles: { create: [{ roleId: role.id }] },
      },
      update: {},
    });
    // Accounts seeded by an earlier run have no secret yet - backfill it
    // (only for users who haven't enrolled, so a working MFA is never reset).
    if (!created.mfaSecretEncrypted && !created.mfaEnrolled) {
      await prisma.user.update({
        where: { id: created.id },
        data: { mfaSecretEncrypted: authenticator.generateSecret() },
      });
    }
  }

  console.log('Seed complete (synthetic test data only).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
