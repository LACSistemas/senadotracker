import { getAdminUser } from '../../../../packages/db/src/postgres-analytics.ts';
import { analyticsPool } from '../analytics/db.ts';
import { verifyPassword } from './password.ts';

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const user = await getAdminUser(analyticsPool, email);
  if (!user) return false;
  return verifyPassword(password, user.passwordHash);
}
