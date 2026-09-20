import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateQrCode } from "@/lib/auth/totp";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized. Please log in first.", 401);
    }

    // Try finding by session ID first, fallback to lowercased email
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

    // Generate fresh TOTP secret
    const { secret, otpauthUrl } = generateTotpSecret(user.email, "AI Interview Prep");
    const qrCodeUrl = await generateQrCode(otpauthUrl);

    // Save secret on user record pending confirmation (2fa_enabled remains false)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
      },
    });

    return successResponse(
      {
        secret,
        qrCodeUrl,
      },
      "2FA setup initialized. Please scan the QR code and verify your code."
    );
  } catch (err) {
    return errorResponse("Failed to initiate 2FA setup.", 500, err);
  }
}
