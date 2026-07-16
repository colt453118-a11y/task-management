import { getDb, schema } from '@workmanagement/database';
import { eq } from 'drizzle-orm';
import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

async function createAdmin() {
  const db = getDb();
  console.log('🔧 Creating admin user...');

  const email = 'colt453118@gmail.com';
  const password = 'Colt@180731';

  // ─── Check if user already exists ──────────────────────
  const [existingUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existingUser) {
    console.log(`  ✓ Admin user already exists (id: ${existingUser.id})`);
    return;
  }

  // ─── Get default organization ──────────────────────────
  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, 'default'))
    .limit(1);

  if (!org) {
    console.error('❌ No default organization found. Run db:seed first.');
    process.exit(1);
  }

  // ─── Get admin role ────────────────────────────────────
  const [adminRole] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.slug, 'admin'))
    .limit(1);

  if (!adminRole) {
    console.error('❌ No admin role found. Run db:seed first.');
    process.exit(1);
  }

  const userId = crypto.randomUUID();

  // Hash using scrypt with same parameters as better-auth v1.6.23
  const salt = randomBytes(16).toString('hex');
  const hashBuf = (await scryptAsync(password, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;
  const passwordHash = `${salt}:${hashBuf.toString('hex')}`;

  console.log(`  ✓ Password hashed with scrypt`);

  // ─── Create user ────────────────────────────────────────
  await db.insert(schema.users).values({
    id: userId,
    email,
    name: 'Admin User',
    firstName: 'Admin',
    lastName: 'User',
    displayName: 'Admin User',
    emailVerified: true,
    organizationId: org.id,
    isActive: true,
    isSuspended: false,
  });
  console.log(`  ✓ User created: ${email} (id: ${userId})`);

  // ─── Create account (for email/password login) ─────────
  await db.insert(schema.accounts).values({
    id: crypto.randomUUID(),
    userId,
    accountId: email,
    providerId: 'credential',
    password: passwordHash,
  });
  console.log(`  ✓ Account created for email/password login`);

  // ─── Assign admin role ─────────────────────────────────
  await db.insert(schema.userRoles).values({
    id: crypto.randomUUID(),
    userId,
    roleId: adminRole.id,
  });
  console.log(`  ✓ Admin role assigned`);
  console.log(`\n✅ Admin user created successfully!`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   URL:      http://localhost:3000/auth/login`);

  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('❌ Failed to create admin user:', err);
  process.exit(1);
});
