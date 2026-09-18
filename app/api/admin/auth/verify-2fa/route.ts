import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/auth/totp";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminChallengeToken,
} from "@/lib/auth/admin-session";
import { successResponse, errorResponse } from "@/lib/api-response";

const VerifyAdmin2FASchema = z.object({
  challengeToken: z.string().min(1, "Challenge token is required."),
  code: z.string().regex(/^\d{6}$/, "Must be a 6-digit authentication code."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = VerifyAdmin2FASchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input.", 400);
    }

    const { challengeToken, code } = validation.data;

    // Validate short-lived challenge token
    const challengePayload = await verifyAdminChallengeToken(challengeToken);
    if (!challengePayload) {
      return errorResponse("Authentication challenge expired or invalid. Please start again.", 401);
    }

    const admin = await prisma.admin.findUnique({
      where: { id: challengePayload.adminId },
    });

    if (!admin || !admin.twoFactorSecret) {
      return errorResponse("Admin account configuration error. 2FA secret missing.", 500);
    }

    // Verify mandatory TOTP code
    const isTotpValid = verifyTotp(admin.twoFactorSecret, code);
    if (!isTotpValid) {
      // Record failed 2FA verification attempt (STRICT RULE: NO IP ADDRESS LOGGING)
      await prisma.loginLog.create({
        data: {
          adminId: admin.id,
          method: "ADMIN_CREDENTIALS",
          success: false,
        },
      });
      return errorResponse("Invalid two-factor authentication code. Please try again.", 401);
    }

    // Record successful admin authentication (STRICT RULE: NO IP ADDRESS LOGGING)
    await prisma.loginLog.create({
      data: {
        adminId: admin.id,
        method: "ADMIN_CREDENTIALS",
        success: true,
      },
    });

    // Create 8-hour isolated admin session token
    const sessionToken = await createAdminSessionToken({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    const response = successResponse(
      {
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.role,
        },
      },
      "Admin authentication successful."
    );

    // Set isolated HTTP-only cookie
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (err) {
    return errorResponse("2FA verification failed. Please try again.", 500, err);
  }
}
