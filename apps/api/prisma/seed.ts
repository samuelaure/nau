import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  console.log('Seeding test database...');

  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 12);
      const workspaceName = "E2E Test Workspace";
      const workspaceSlug = "e2e-test-workspace";
      await prisma.user.create({
        data: {
          email,
          name: 'E2E Test User',
          passwordHash,
          workspaces: {
            create: {
              role: 'OWNER',
              workspace: { create: { name: workspaceName, slug: workspaceSlug } },
            },
          },
        },
      });
      console.log(`E2E test user created: ${email}`);
    } else {
      console.log(`E2E test user already exists: ${email}`);
    }
  }

  console.log('Test database seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
