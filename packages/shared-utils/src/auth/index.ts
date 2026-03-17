/**
 * JWT Authentication utilities — password hashing + dual token system.
 * Extracted from PostPilot + KeyDrop.
 *
 * Usage:
 *   import { hashPassword, verifyPassword, signAccessToken, verifyAccessToken } from '@royea/shared-utils/auth';
 *
 *   const hash = await hashPassword('my-password');
 *   const valid = await verifyPassword('my-password', hash);
 *   const token = signAccessToken({ userId: '123', email: 'user@example.com' });
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

function getSecret(envVar: string, label: string): string {
  const secret = process.env[envVar];
  if (!secret) throw new Error(`${label} environment variable is required`);
  return secret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  [key: string]: unknown;
}

export interface AuthConfig {
  /** Env var name for JWT secret (default: 'JWT_SECRET') */
  jwtSecretEnv?: string;
  /** Env var name for refresh JWT secret (default: 'JWT_REFRESH_SECRET') */
  jwtRefreshSecretEnv?: string;
  /** Access token expiry (default: '15m') */
  accessTokenExpiry?: string;
  /** Refresh token expiry (default: '7d') */
  refreshTokenExpiry?: string;
  /** Bcrypt salt rounds (default: 12) */
  saltRounds?: number;
}

const defaults: Required<AuthConfig> = {
  jwtSecretEnv: 'JWT_SECRET',
  jwtRefreshSecretEnv: 'JWT_REFRESH_SECRET',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  saltRounds: 12,
};

let cfg: Required<AuthConfig> = { ...defaults };

/** Configure auth settings (call once at app startup if you need non-default values) */
export function configureAuth(config: AuthConfig): void {
  cfg = { ...defaults, ...config };
}

// --- Password hashing ---

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, cfg.saltRounds);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

// --- JWT tokens ---

export function signAccessToken(payload: TokenPayload): string {
  const secret = getSecret(cfg.jwtSecretEnv, cfg.jwtSecretEnv);
  return jwt.sign(payload as object, secret, { expiresIn: cfg.accessTokenExpiry as any });
}

export function signRefreshToken(payload: TokenPayload): string {
  const secret = getSecret(cfg.jwtRefreshSecretEnv, cfg.jwtRefreshSecretEnv);
  return jwt.sign(payload as object, secret, { expiresIn: cfg.refreshTokenExpiry as any });
}

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, getSecret(cfg.jwtSecretEnv, cfg.jwtSecretEnv)) as TokenPayload;

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, getSecret(cfg.jwtRefreshSecretEnv, cfg.jwtRefreshSecretEnv)) as TokenPayload;

// --- Helpers ---

/** Extract Bearer token from Authorization header */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/** Middleware-style auth check: extracts + verifies token, returns payload or null */
export function authenticateRequest(request: Request): TokenPayload | null {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
