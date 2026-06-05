import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const cookieName = 'lujo_admin_session';

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('Falta ADMIN_SESSION_SECRET o ADMIN_PASSWORD.');
  return secret;
};

export const getAdminUser = () => process.env.ADMIN_USER || 'admin';

export const signSession = (username: string) =>
  createHmac('sha256', getSecret()).update(username).digest('hex');

export const verifyPassword = (username: string, password: string) => {
  const expectedUser = getAdminUser().trim();
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPassword) throw new Error('Falta ADMIN_PASSWORD.');

  return username.trim() === expectedUser && password.trim() === expectedPassword;
};

export const createSession = async (username: string) => {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, `${username}.${signSession(username)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
};

export const destroySession = async () => {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
};

export const isAuthenticated = async () => {
  const cookieStore = await cookies();
  const session = cookieStore.get(cookieName)?.value;
  if (!session) return false;

  const [username, signature] = session.split('.');
  if (!username || !signature) return false;

  const expected = signSession(username);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
};
