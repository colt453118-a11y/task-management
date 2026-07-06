import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export { schema };

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    const client = postgres(connectionString, {
      prepare: false,
      max: 10,
      idle_timeout: 30,
    });
    db = drizzle(client, { schema });
  }
  return db;
}

export { schema as default };
