import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized. Please log in first.", 401);
    }

    const body = await req.json();
    const { password } = body;

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

    // Require password confirmation if user has a password set
    if (user.passwordHash) {
      if (!password) {
        return errorResponse("Password confirmation is required to disable 2FA.", 400);
      }
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return errorResponse("Incorrect password.", 400);
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return successResponse(
      { twoFactorEnabled: false },
      "Two-factor authentication has been disabled."
    );
  } catch (err) {
    return errorResponse("Failed to disable 2FA.", 500, err);
  }
}
