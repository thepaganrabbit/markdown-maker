import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';
import { env } from '@/lib/env';
import type { User } from '@/lib/models';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let indexesPromise: Promise<void> | null = null;

const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getClientPromise() {
  if (clientPromise) return clientPromise;

  if (process.env.NODE_ENV === 'development') {
    // Reuse a global client in dev to avoid connection churn during HMR reloads.
    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(env.MONGODB_URI);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    client = new MongoClient(env.MONGODB_URI);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function ensureAdminUser(mongoClient: MongoClient) {
  const db = mongoClient.db();
  const users = db.collection<User>('users');

  const email = 'master@master.com';
  const password = 'skittles123';
  const existing = await users.findOne({ email });

  if (existing) {
    if (existing.role !== 'admin') {
      await users.updateOne({ _id: existing._id }, { $set: { role: 'admin' } });
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await users.insertOne({
    email,
    passwordHash,
    role: 'admin',
    createdAt: new Date()
  });
}

async function ensureIndexes(mongoClient: MongoClient) {
  if (indexesPromise) return indexesPromise;

  // Run once per process to keep startup deterministic and idempotent.
  indexesPromise = (async () => {
    const db = mongoClient.db();
    await Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' }),
      db
        .collection('sessions')
        .createIndex({ refreshToken: 1 }, { unique: true, sparse: true, name: 'sessions_refreshToken_unique' }),
      db.collection('sessions').createIndex(
        { refreshTokenHash: 1 },
        { unique: true, sparse: true, name: 'sessions_refreshTokenHash_unique' }
      ),
      db.collection('markdown_docs').createIndex(
        { userId: 1, updatedAt: -1 },
        { name: 'markdown_docs_userId_updatedAt_desc' }
      )
    ]);

    await ensureAdminUser(mongoClient);
  })();

  return indexesPromise;
}

export async function getDb() {
  const mongoClient = await getClientPromise();
  await ensureIndexes(mongoClient);
  return mongoClient.db();
}
