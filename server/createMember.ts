import { storage } from './storage';
import { hashPassword, sanitizeUser } from './security';
import type { InsertUser } from '../shared/schema';

export class MemberCreationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Shared by manual creation and CSV import. Never logs input or database errors. */
export async function createMember(data: InsertUser) {
  const username = typeof data.username === 'string' ? data.username.toLowerCase().trim() : '';
  if (!username) throw new MemberCreationError('Username is required');
  if (!data.password || String(data.password).length < 8) {
    throw new MemberCreationError('Password must be at least 8 characters');
  }
  if (await storage.getUserByUsername(username)) throw new MemberCreationError('Username already exists');
  try {
    const user = await storage.createUser({ ...data, username, password: await hashPassword(String(data.password)) });
    return sanitizeUser(user);
  } catch (error: any) {
    // PostgreSQL unique constraints also protect against concurrent requests.
    if (error?.code === '23505' || error?.cause?.code === '23505') {
      throw new MemberCreationError('Username already exists');
    }
    throw new MemberCreationError('Could not create member; re-preview before retrying', 500);
  }
}
