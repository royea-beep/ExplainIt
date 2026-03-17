import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken, buildAuthCookie, COOKIE_NAME } from '../auth';

// JWT_SECRET is required for token operations
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-vitest-only';
});

describe('password hashing', () => {
  it('should hash and verify a password', async () => {
    const hash = await hashPassword('myP@ssword123');
    expect(hash).toContain(':');
    expect(hash).not.toBe('myP@ssword123');

    const valid = await verifyPassword('myP@ssword123', hash);
    expect(valid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correctPassword');
    const valid = await verifyPassword('wrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('should reject malformed hash', async () => {
    expect(await verifyPassword('test', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('test', '')).toBe(false);
  });

  it('should produce unique hashes for same password (random salt)', async () => {
    const h1 = await hashPassword('samePassword');
    const h2 = await hashPassword('samePassword');
    expect(h1).not.toBe(h2);
    // But both should verify
    expect(await verifyPassword('samePassword', h1)).toBe(true);
    expect(await verifyPassword('samePassword', h2)).toBe(true);
  });
});

describe('JWT tokens', () => {
  it('should sign and verify a token', async () => {
    const token = await signToken({ userId: 'u123', email: 'test@test.com' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('u123');
    expect(payload!.email).toBe('test@test.com');
  });

  it('should return null for invalid token', async () => {
    expect(await verifyToken('not.a.token')).toBeNull();
    expect(await verifyToken('')).toBeNull();
    expect(await verifyToken('eyJ.eyJ.invalid')).toBeNull();
  });

  it('should return null for tampered token', async () => {
    const token = await signToken({ userId: 'u1', email: 'a@b.com' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(await verifyToken(tampered)).toBeNull();
  });
});

describe('auth cookies', () => {
  it('should build httpOnly SameSite cookie', () => {
    const cookie = buildAuthCookie('my-token-value');
    expect(cookie).toContain(`${COOKIE_NAME}=my-token-value`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=');
  });

  it('should NOT include Secure in non-production', () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'development';
    const cookie = buildAuthCookie('tok');
    expect(cookie).not.toContain('Secure');
    env.NODE_ENV = prev;
  });

  it('should include Secure in production', () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    const cookie = buildAuthCookie('tok');
    expect(cookie).toContain('Secure');
    env.NODE_ENV = prev;
  });
});
