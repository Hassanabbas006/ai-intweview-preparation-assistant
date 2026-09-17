/**
 * Auth & 2FA Helper Stub per Architecture.md & Rules.md.
 * Implementation will occur in Phase 1: Auth (user + admin).
 */

export interface AuthSessionUser {
  id: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
}
