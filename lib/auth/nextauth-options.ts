import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        const email = credentials.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          // Record failed login audit log (STRICT RULE: NO IP ADDRESS LOGGING)
          await prisma.loginLog.create({
            data: {
              method: "CREDENTIALS",
              success: false,
            },
          });
          throw new Error("Invalid email or password.");
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) {
          // Record failed login audit log (STRICT RULE: NO IP ADDRESS LOGGING)
          await prisma.loginLog.create({
            data: {
              userId: user.id,
              method: "CREDENTIALS",
              success: false,
            },
          });
          throw new Error("Invalid email or password.");
        }

        // Check 2FA if enabled on candidate account
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!credentials.twoFactorCode) {
            // Signal to frontend that 2FA code is needed
            throw new Error("2FA_REQUIRED");
          }

          const isTotpValid = verifyTotp(user.twoFactorSecret, credentials.twoFactorCode);
          if (!isTotpValid) {
            await prisma.loginLog.create({
              data: {
                userId: user.id,
                method: "CREDENTIALS",
                success: false,
              },
            });
            throw new Error("Invalid 2FA authentication code.");
          }
        }

        // Record successful login audit log (STRICT RULE: NO IP ADDRESS LOGGING)
        await prisma.loginLog.create({
          data: {
            userId: user.id,
            method: "CREDENTIALS",
            success: true,
          },
        });

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          domain: user.domain,
          twoFactorEnabled: user.twoFactorEnabled,
          hasPassword: true,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;

        const email = user.email.trim().toLowerCase();

        // Upsert candidate record for Google sign-in
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        let candidateId: string;

        if (existingUser) {
          candidateId = existingUser.id;
          user.id = existingUser.id; // Assign database User ID to NextAuth user object
          user.role = existingUser.role;
          user.domain = existingUser.domain;
          user.twoFactorEnabled = existingUser.twoFactorEnabled;
          user.hasPassword = !!existingUser.passwordHash;

          if (!existingUser.googleId) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { googleId: account.providerAccountId },
            });
          }
        } else {
          const newUser = await prisma.user.create({
            data: {
              email,
              googleId: account.providerAccountId,
              role: "USER",
            },
          });
          candidateId = newUser.id;
          user.id = newUser.id; // Assign database User ID to NextAuth user object
          user.role = newUser.role;
          user.domain = newUser.domain;
          user.twoFactorEnabled = newUser.twoFactorEnabled;
          user.hasPassword = false;
        }

        // Record Google OAuth login audit log (STRICT RULE: NO IP ADDRESS LOGGING)
        await prisma.loginLog.create({
          data: {
            userId: candidateId,
            method: "GOOGLE",
            success: true,
          },
        });
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Fast, synchronous token assignment from user object
        token.id = user.id;
        token.role = user.role || "USER";
        token.domain = user.domain || null;
        token.twoFactorEnabled = user.twoFactorEnabled || false;
        token.hasPassword = user.hasPassword !== undefined ? user.hasPassword : false;
      }

      // If token.hasPassword was uninitialized in older sessions, query database
      if (token.hasPassword === undefined && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { passwordHash: true },
          });
          token.hasPassword = !!dbUser?.passwordHash;
        } catch {
          token.hasPassword = false;
        }
      }

      // Handle session updates (e.g. enabling/disabling 2FA or updating domain)
      if (trigger === "update" && session) {
        if (session.domain !== undefined) token.domain = session.domain;
        if (session.twoFactorEnabled !== undefined) token.twoFactorEnabled = session.twoFactorEnabled;
        if (session.hasPassword !== undefined) token.hasPassword = session.hasPassword;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.domain = token.domain;
        session.user.twoFactorEnabled = token.twoFactorEnabled;
        session.user.hasPassword = token.hasPassword ?? false;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days per user approved plan
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
