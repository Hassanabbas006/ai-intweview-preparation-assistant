export * from "./password";
export * from "./totp";
export * from "./admin-session";
export * from "./nextauth-options";

export interface AuthSessionUser {
  id: string;
  email: string;
  role: string;
  domain?: string | null;
  twoFactorEnabled: boolean;
}
