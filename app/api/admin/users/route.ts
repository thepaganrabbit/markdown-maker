import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import type { Session, User } from '@/lib/models';
import { hashPassword } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin';
import { parseJson, adminCreateUserSchema } from '@/lib/validation';
import { verifyCsrfForCookieAuth } from '@/lib/csrf';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const SORT_FIELDS = ['createdAt', 'email', 'role'] as const;
type SortField = (typeof SORT_FIELDS)[number];
type SortDir = 'asc' | 'desc';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const roleParam = (url.searchParams.get('role') ?? 'all').toLowerCase();
  const sortByParam = (url.searchParams.get('sortBy') ?? 'createdAt').toLowerCase();
  const sortDirParam = (url.searchParams.get('sortDir') ?? 'desc').toLowerCase();
  const page = Math.max(DEFAULT_PAGE, Number(url.searchParams.get('page') ?? DEFAULT_PAGE) || DEFAULT_PAGE);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE)
  );
  const sortBy: SortField = SORT_FIELDS.includes(sortByParam as SortField)
    ? (sortByParam as SortField)
    : 'createdAt';
  const sortDir: SortDir = sortDirParam === 'asc' ? 'asc' : 'desc';
  const sortValue = sortDir === 'asc' ? 1 : -1;

  const filter: Record<string, unknown> = {};
  if (q) {
    filter.email = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (roleParam === 'user' || roleParam === 'admin') {
    filter.role = roleParam;
  }

  const db = await getDb();
  const users = db.collection<User>('users');
  const sessions = db.collection<Session>('sessions');

  const [items, total] = await Promise.all([
    users
      .find(filter)
      .project({ email: 1, role: 1, createdAt: 1 })
      .sort({ [sortBy]: sortValue })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    users.countDocuments(filter)
  ]);

  const userIds = items.map((item) => item._id).filter((id): id is ObjectId => Boolean(id));
  const onlineIds = new Set<string>();

  if (userIds.length > 0) {
    const activeUserIds = await sessions.distinct('userId', {
      userId: { $in: userIds },
      expiresAt: { $gt: new Date() }
    });
    for (const id of activeUserIds) {
      onlineIds.add(id.toString());
    }
  }

  return NextResponse.json({
    users: items.map((item) => ({
      id: item._id!.toString(),
      email: item.email,
      role: item.role,
      createdAt: item.createdAt,
      isOnline: onlineIds.has(item._id!.toString())
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    },
    filters: {
      q,
      role: roleParam === 'user' || roleParam === 'admin' ? roleParam : 'all',
      sortBy,
      sortDir
    }
  });
}

export async function POST(request: Request) {
  const csrfError = verifyCsrfForCookieAuth(request);
  if (csrfError) return csrfError;

  const { error: adminError } = await requireAdmin(request);
  if (adminError) return adminError;

  const { data, error } = await parseJson(request, adminCreateUserSchema);
  if (error) return error;

  const db = await getDb();
  const users = db.collection<User>('users');

  const existing = await users.findOne({ email: data.email });
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(data.password);
  const createdAt = new Date();
  const result = await users.insertOne({
    email: data.email,
    passwordHash,
    role: data.role,
    createdAt
  });

  return NextResponse.json(
    {
      user: {
        id: result.insertedId.toString(),
        email: data.email,
        role: data.role,
        createdAt
      }
    },
    { status: 201 }
  );
}
