import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { successResponse, errorResponse } from "@/lib/api-response";

const RequestResetSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = RequestResetSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(validation.error.errors[0]?.message || "Invalid input.", 400);
    }

    const { email } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Generic response message to prevent email enumeration
    const genericSuccessMessage =
      "If an account exists with this email address, a password reset link has been sent.";

    if (!user) {
      return successResponse(null, genericSuccessMessage);
    }

    // Invalidate any existing unused reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Generate high-entropy 32-byte random token
    const plainToken = crypto.randomBytes(32).toString("hex");

    // Store only SHA-256 hash in database
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

    // 20-minute token expiration
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        used: false,
      },
    });

    // Determine base URL (from NEXTAUTH_URL or incoming request host)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${plainToken}`;

    // Send transactional email
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });

    return successResponse(null, genericSuccessMessage);
  } catch (err) {
    return errorResponse("Failed to process password reset request.", 500, err);
  }
}
