/**
 * Lightweight JWT auth for ExplainIt.
 * Requires env: JWT_SECRET.
 * Sign/verify single token (7d). Also supports password hashing (scrypt) and getUserIdFromRequest (Bearer or cookie).
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';

const scryptAsync = promisify(scrypt);

const JWT_SECRET_ENV = 'JWT_SECRET';
const TOKEN_EXPIRY = '7d';
const COOKIE_NAME = 'explainit_token';

export interface TokenPayload {
  userId: string;
  email: string;
}

function getSecret(): string {
  const secret = process.env[JWT_SECRET_ENV];
  if (!secret) throw new Error(`${JWT_SECRET_ENV} is required`);
  return secret;
}

/** Hash password with scrypt (no bcrypt dependency). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

/** Verify password against hash from hashPassword. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedKeyHex] = hash.split(':');
  if (!salt || !storedKeyHex) return false;
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(storedKeyHex, 'hex');
  return key.length === storedKey.length && timingSafeEqual(key, storedKey);
}

/** Sign a JWT with payload, expire 7d. Uses JWT_SECRET. */
export async function signToken(payload: TokenPayload): Promise<string> {
  const secret = getSecret();
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const jwt = new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY);
  return await jwt.sign(key);
}

/** Verify JWT; returns payload or null. */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getSecret();
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const { payload } = await jwtVerify(token, key);
    const userId = payload.userId as string | undefined;
    const email = payload.email as string | undefined;
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

/** Extract Bearer token from Authorization header. */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

/** Get token from request: Authorization Bearer or cookie. */
function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  const bearer = extractBearerToken(authHeader);
  if (bearer) return bearer;
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Read Authorization Bearer or cookie, verify JWT, return userId or null.
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.userId ?? null;
}

export { COOKIE_NAME };
