import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Credentials come from the environment — NEVER hardcode them here.
//   ADMIN_EMAIL      (optional; defaults below)
//   ADMIN_PASSWORD   (required; rotate to a fresh random value, e.g.
//                    `openssl rand -base64 18`)
//
// Run with:
//   ADMIN_PASSWORD=... node --import tsx scripts/fix-password.ts
// (set DATABASE_URL to the target database first)

async function fixPassword() {
  console.log('🔧 Fixing admin password hash...');

  const email = process.env.ADMIN_EMAIL ?? 'colt453118@gmail.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error(
      '❌ ADMIN_PASSWORD environment variable is required (never commit a default).\n' +
        '   Generate one with: openssl rand -base64 18\n' +
        '   Then: ADMIN_PASSWORD=... DATABASE_URL=... node --import tsx scripts/fix-password.ts',
    );
    process.exit(1);
  }

  // Hash using scrypt with same parameters as @better-auth/utils/password:
  // N=16384, r=16, p=1, dkLen=64, salt=16 random bytes
  const salt = randomBytes(16).toString('hex');
  const hashBuf = (await scryptAsync(password, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 64 * 1024 * 1024, // 64MB
  })) as Buffer;
  const hash = hashBuf.toString('hex');
  const scryptHash = `${salt}:${hash}`;

  console.log(`  ✓ Password hashed with scrypt`);
  console.log(`  Hash format: ${scryptHash.substring(0, 40)}...`);

  // Now update the database
  const { getDb, schema } = await import('@workmanagement/database');
  const { eq } = await import('drizzle-orm');

  const db = getDb();

  // Find the user
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user) {
    console.error(`❌ User ${email} not found`);
    process.exit(1);
  }
  console.log(`  ✓ Found user: ${user.id}`);

  // Update the account password
  const [account] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id))
    .limit(1);

  if (account) {
    await db
      .update(schema.accounts)
      .set({ password: scryptHash })
      .where(eq(schema.accounts.id, account.id));
    console.log(`  ✓ Account password updated`);
  } else {
    console.error(`❌ No account found for user`);
    process.exit(1);
  }

  console.log(`\n✅ Password updated!`);
  console.log(`   Email:    ${email}`);
  console.log(`   (ADMIN_PASSWORD value is never printed)`);
  process.exit(0);
}

fixPassword().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
