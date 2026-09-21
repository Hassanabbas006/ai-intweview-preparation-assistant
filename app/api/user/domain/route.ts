import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/nextauth-options";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { VALID_DOMAIN_VALUES } from "@/lib/constants/domains";

const UpdateDomainSchema = z.object({
  domain: z.enum(VALID_DOMAIN_VALUES, {
    errorMap: () => ({ message: "Please select a valid target track/domain." }),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id && !session?.user?.email) {
      return errorResponse("Unauthorized. Please log in first.", 401);
    }

    const body = await req.json();
    const validation = UpdateDomainSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(
        validation.error.errors[0]?.message || "Invalid domain selection.",
        400
      );
    }

    const { domain } = validation.data;

    // Scoped strictly to the logged-in candidate
    let user = session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null;

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email.trim().toLowerCase() },
      });
    }

    if (!user) {
      return errorResponse("User account not found.", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { domain },
      select: {
        id: true,
        email: true,
        domain: true,
        role: true,
        twoFactorEnabled: true,
      },
    });

    return successResponse(
      { domain: updatedUser.domain },
      "Target track / domain updated successfully."
    );
  } catch (err) {
    return errorResponse("Failed to update target domain.", 500, err);
  }
}
