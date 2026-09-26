import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/2fa/disable
 * Returns the candidate's authentication profile to determine whether
 * 2FA disabling requires a password (credentials) or a 6-digit TOTP code (Google OAuth).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized. Please log in first.", 401);
    }

    let user = session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null;

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email.trim().toLowerCase() },
      });
    }

    if (!user) {
      return errorResponse("User not found.", 404);
    }

    return successResponse({
      hasPassword: !!user.passwordHash,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (err) {
    return errorResponse("Failed to fetch 2FA security status.", 500, err);
  }
}

/**
 * POST /api/auth/2fa/disable
 * Disables 2FA with appropriate verification:
 * - Credentials accounts: Validates account password
 * - Google-only accounts: Validates current 6-digit TOTP code from Authenticator app
 */
export async function POST(req: NextRequest) {
  const t0 = performance.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized. Please log in first.", 401);
    }

    const body = await req.json().catch(() => ({}));
    const { password, code, totpCode, twoFactorCode } = body;

    let user = session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null;

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email.trim().toLowerCase() },
      });
    }

    if (!user) {
      return errorResponse("User not found.", 404);
    }

    if (!user.twoFactorEnabled) {
      return errorResponse("Two-factor authentication is not currently enabled.", 400);
    }

    // 1) Accounts with a real password set: require password confirmation
    if (user.passwordHash) {
      if (!password || typeof password !== "string") {
        return errorResponse("Account password is required to disable 2FA.", 400);
      }
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return errorResponse("Incorrect account password.", 400);
      }
    } else {
      // 2) Accounts with no password (Google OAuth): require current 6-digit TOTP confirmation
      const submittedCode = (totpCode || code || twoFactorCode || "").toString().trim();
      if (!submittedCode) {
        return errorResponse("Please enter your current 6-digit 2FA code to disable Two-Factor Authentication.", 400);
      }

      if (!user.twoFactorSecret) {
        return errorResponse("2FA secret is missing. Please contact support.", 400);
      }

      const isValidTotp = verifyTotp(user.twoFactorSecret, submittedCode);
      if (!isValidTotp) {
        return errorResponse("Invalid 2FA authentication code. Please check your authenticator app and try again.", 400);
      }
    }

    // Disable 2FA on candidate record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    console.log(`[API Timing: Disable 2FA] User ${user.id} disabled 2FA in ${(performance.now() - t0).toFixed(1)}ms`);

    return successResponse(
      { twoFactorEnabled: false },
      "Two-factor authentication has been disabled."
    );
  } catch (err) {
    console.error(`[API Timing: Disable 2FA] Error after ${(performance.now() - t0).toFixed(1)}ms:`, err);
    return errorResponse("Failed to disable 2FA.", 500, err);
  }
}
