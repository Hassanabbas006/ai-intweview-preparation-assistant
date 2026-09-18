import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_SESSION_DURATION = 8 * 60 * 60; // 8 hours in seconds per approved plan

export interface AdminSessionPayload {
  adminId: string;
  email: string;
  role: string;
}

export interface AdminChallengePayload {
  adminId: string;
  email: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || "default-dev-secret-change-in-production-min32chars";
  return new TextEncoder().encode(secret);
}

/**
 * Creates an isolated signed JWT session token for an authenticated admin (8-hour duration).
 */
export async function createAdminSessionToken(payload: AdminSessionPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload, type: "admin_session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION}s`)
    .sign(secret);
}

/**
 * Verifies and decodes an admin session token. Returns payload or null if invalid/expired.
 */
export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "admin_session" || !payload.adminId || !payload.email || !payload.role) {
      return null;
    }
    return {
      adminId: payload.adminId as string,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a short-lived (5 min) challenge token for admin 2FA verification step.
 */
export async function createAdminChallengeToken(payload: AdminChallengePayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload, type: "admin_2fa_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

/**
 * Verifies the 5-minute admin 2FA challenge token.
 */
export async function verifyAdminChallengeToken(token: string): Promise<AdminChallengePayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "admin_2fa_challenge" || !payload.adminId || !payload.email) {
      return null;
    }
    return {
      adminId: payload.adminId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves and validates the current admin session from incoming cookies (Server Component / Route Handler).
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}
