import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { verifyTotp } from "@/lib/auth/totp";
import { successResponse, errorResponse } from "@/lib/api-response";

const Check2FASchema = z.object({
  email: z.string().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
  twoFactorCode: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  try {
    const body = await req.json();
    const validation = Check2FASchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input.", 400);
    }

    const { email, password, twoFactorCode } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return errorResponse("Invalid email or password.", 401);
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse("Invalid email or password.", 401);
    }

    // Check if 2FA is enabled for this candidate account
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!twoFactorCode) {
        // Return clear status indicating 2FA code input is required (Not an error!)
        console.log(`[API Timing: 2FA Check] Pre-flight check (2FA required) completed in ${(performance.now() - t0).toFixed(1)}ms`);
        return successResponse(
          { requires2FA: true },
          "2FA_REQUIRED"
        );
      }

      // Verify submitted TOTP code
      const isTotpValid = verifyTotp(user.twoFactorSecret, twoFactorCode);
      if (!isTotpValid) {
        return errorResponse("Invalid 2FA authentication code.", 400);
      }
    }

    console.log(`[API Timing: 2FA Check] Pre-flight check (Validated) completed in ${(performance.now() - t0).toFixed(1)}ms`);
    return successResponse(
      { requires2FA: false },
      "2FA_VALIDATED"
    );
  } catch (err) {
    console.error(`[API Timing: 2FA Check] Error after ${(performance.now() - t0).toFixed(1)}ms:`, err);
    return errorResponse("Pre-flight authentication check failed.", 500, err);
  }
}
