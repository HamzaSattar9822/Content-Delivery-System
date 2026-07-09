import { PrismaClient, FileType, NotificationType } from '@prisma/client';
import crypto from 'crypto';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  ROLES,
  RoleName,
} from '../src/config/permissions';

const prisma = new PrismaClient();

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function seedPermissions() {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }
  console.log(`Seeded ${ALL_PERMISSIONS.length} permissions`);
}

async function seedRoles() {
  for (const roleName of Object.values(ROLES) as RoleName[]) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: ROLE_DESCRIPTIONS[roleName], isSystem: true },
      create: { name: roleName, description: ROLE_DESCRIPTIONS[roleName], isSystem: true },
    });

    const permissionKeys = ROLE_PERMISSIONS[roleName];
    const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log('Seeded roles and role-permission mappings');
}

async function seedSuperAdmin() {
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  if (!email) {
    console.log('BOOTSTRAP_SUPER_ADMIN_EMAIL not set; skipping super admin hint');
    return;
  }
  // Do not create a user here — sign up (Better Auth) with this email to set a
  // password. The user.create hook in src/lib/auth.ts assigns SUPER_ADMIN to
  // the BOOTSTRAP_SUPER_ADMIN_EMAIL; everyone else defaults to READ_ONLY.
  console.log(`Bootstrap admin email: ${email} (sign up with this email to create the account)`);
}

async function seedSampleData() {
  if (process.env.SEED_SAMPLE_DATA === 'false') return;

  const category = await prisma.category.upsert({
    where: { slug: 'training' },
    update: {},
    create: { name: 'Training', slug: 'training', description: 'Training and onboarding videos' },
  });

  const content = await prisma.content.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Welcome to the Content Delivery System',
      description: 'A sample piece of content. Replace the Drive file id with a real one.',
      fileType: FileType.VIDEO,
      mimeType: 'video/mp4',
      googleDriveFileId: 'REPLACE_WITH_REAL_DRIVE_FILE_ID',
      fileSize: BigInt(0),
      categoryId: category.id,
    },
  });

  // A sample, never-expiring link with a 100-view limit.
  const sampleToken = 'sample-demo-token-replace-me';
  await prisma.accessLink.upsert({
    where: { tokenHash: sha256(sampleToken) },
    update: {},
    create: {
      tokenHash: sha256(sampleToken),
      label: 'Demo link (100 views)',
      contentId: content.id,
      neverExpire: true,
      maxViews: 100,
    },
  });

  // Default view-threshold notification rules (global).
  const thresholds = [100, 250, 500, 1000];
  for (const threshold of thresholds) {
    const existing = await prisma.notificationRule.findFirst({
      where: { type: NotificationType.VIEW_THRESHOLD, threshold, linkId: null },
    });
    if (!existing) {
      await prisma.notificationRule.create({
        data: { type: NotificationType.VIEW_THRESHOLD, threshold },
      });
    }
  }

  // Baseline settings.
  const settings: { key: string; value: unknown; description: string }[] = [
    { key: 'branding.appName', value: 'Content Delivery System', description: 'Display name shown in the UI' },
    { key: 'security.defaultLinkTtlDays', value: 30, description: 'Default link lifetime in days' },
    { key: 'streaming.allowIframeEmbedding', value: true, description: 'Allow LMS/iframe embedding of the player' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { key: s.key, value: s.value as any, description: s.description },
    });
  }

  console.log('Seeded sample category, content, link, notification rules and settings');
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedSuperAdmin();
  await seedSampleData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed complete');
  })
  .catch(async (err) => {
    console.error('Seed failed', err);
    await prisma.$disconnect();
    process.exit(1);
  });
