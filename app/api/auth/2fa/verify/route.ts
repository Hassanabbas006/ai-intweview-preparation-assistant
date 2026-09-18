import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/auth/totp";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return errorResponse("Unauthorized. Please log in first.", 401);
    }

    const body = await req.json();
    const token = body?.token;

    if (!token || typeof token !== "string") {
      return errorResponse("Verification token is required.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.twoFactorSecret) {
      return errorResponse("No pending 2FA setup found. Please initiate setup first.", 400);
    }

    const isValid = verifyTotp(user.twoFactorSecret, token);
    if (!isValid) {
      return errorResponse("Invalid authentication code. Please check your authenticator app and try again.", 400);
    }

    // Activate 2FA on candidate account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
      },
    });

    return successResponse(
      { twoFactorEnabled: true },
      "Two-factor authentication has been successfully activated on your account."
    );
  } catch (err) {
    return errorResponse("Failed to verify 2FA token.", 500, err);
  }
}
