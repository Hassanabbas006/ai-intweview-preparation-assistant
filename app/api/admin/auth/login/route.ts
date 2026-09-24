import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createAdminChallengeToken } from "@/lib/auth/admin-session";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const AdminLoginSchema = z.object({
  email: z.string().email("Please provide a valid admin email."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = AdminLoginSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input.", 400);
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    const admin = await prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!admin) {
      // Record failed admin login attempt (STRICT RULE: NO IP ADDRESS LOGGING)
      await prisma.loginLog.create({
        data: {
          method: "ADMIN_CREDENTIALS",
          success: false,
        },
      });
      return errorResponse("Invalid admin credentials.", 401);
    }

    const isPasswordValid = await verifyPassword(password, admin.passwordHash);
    if (!isPasswordValid) {
      // Record failed admin login attempt (STRICT RULE: NO IP ADDRESS LOGGING)
      await prisma.loginLog.create({
        data: {
          adminId: admin.id,
          method: "ADMIN_CREDENTIALS",
          success: false,
        },
      });
      return errorResponse("Invalid admin credentials.", 401);
    }

    // Passwords match! Because 2FA is mandatory for admin, issue a short-lived challenge token
    const challengeToken = await createAdminChallengeToken({
      adminId: admin.id,
      email: admin.email,
    });

    return successResponse(
      {
        challengeToken,
        requires2FA: true,
      },
      "Credentials verified. Multi-factor authentication code required."
    );
  } catch (err) {
    return errorResponse("Admin login failed. Please try again.", 500, err);
  }
}
