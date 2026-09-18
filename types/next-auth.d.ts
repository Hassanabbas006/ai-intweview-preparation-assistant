import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      domain?: string | null;
      twoFactorEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    domain?: string | null;
    twoFactorEnabled: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    domain?: string | null;
    twoFactorEnabled: boolean;
  }
}
