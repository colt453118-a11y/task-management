import { getDb, schema } from '@workmanagement/database';
import { and, eq } from 'drizzle-orm';

// Promote an existing user to the Administrator role.
//
//   EMAIL=user@example.com DATABASE_URL=... node_modules/.bin/tsx scripts/grant-admin.ts
//
// Useful when a user self-registered (and got the default "member" role) but
// should own/administer the workspace. Idempotent — re-running is a no-op.

async function grantAdmin() {
  const email = process.env.EMAIL ?? process.env.ADMIN_EMAIL;
  if (!email) {
    console.error('❌ EMAIL env var is required (the user to promote to admin).');
    process.exit(1);
  }

  const db = getDb();

  const [user] = await db
    .select({ id: schema.users.id, organizationId: schema.users.organizationId })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user) {
    console.error(`❌ No user found with email ${email}`);
    process.exit(1);
  }

  // Ensure the user belongs to the default org if they don't have one yet.
  let orgId = user.organizationId;
  if (!orgId) {
    const [org] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, 'default'))
      .limit(1);
    if (!org) {
      console.error('❌ No default organization found. Run db:seed first.');
      process.exit(1);
    }
    orgId = org.id;
    await db.update(schema.users).set({ organizationId: orgId }).where(eq(schema.users.id, user.id));
  }

  const [adminRole] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(and(eq(schema.roles.slug, 'admin'), eq(schema.roles.organizationId, orgId)))
    .limit(1);

  if (!adminRole) {
    console.error('❌ No admin role found for the organization. Run db:seed first.');
    process.exit(1);
  }

  await db
    .insert(schema.userRoles)
    .values({ userId: user.id, roleId: adminRole.id })
    .onConflictDoNothing();

  console.log(`✅ Granted 'admin' role to ${email}`);
  process.exit(0);
}

grantAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
