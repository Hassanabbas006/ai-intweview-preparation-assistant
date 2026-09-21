import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { successResponse, errorResponse } from "@/lib/api-response";

const ConfirmResetSchema = z.object({
  token: z.string().min(10, "Invalid reset token."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password is too long."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = ConfirmResetSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input.", 400);
    }

    const { token, password } = validation.data;

    // Hash the submitted token with SHA-256 to compare against stored hash
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      return errorResponse(
        "This password reset link is invalid, expired, or has already been used. Please request a new reset link.",
        400
      );
    }

    // Hash new password with bcrypt 12 rounds
    const passwordHash = await hashPassword(password);

    // Update user password and mark all reset tokens for this user as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: resetRecord.userId, used: false },
        data: { used: true },
      }),
    ]);

    return successResponse(
      null,
      "Password updated successfully! You can now sign in with your new password."
    );
  } catch (err) {
    return errorResponse("Failed to reset password. Please try again.", 500, err);
  }
}
