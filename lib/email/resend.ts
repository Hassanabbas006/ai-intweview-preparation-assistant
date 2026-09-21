import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const defaultFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

/**
 * Sends a password reset email using Resend.
 * Falls back to console logging during local development if RESEND_API_KEY is not configured.
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!resend || !resendApiKey) {
      console.warn(
        `[Email Dev Mock] RESEND_API_KEY not configured. Password reset link for ${to}:\n${resetUrl}`
      );
      return { success: true, id: "dev-mock-id" };
    }

    const { data, error } = await resend.emails.send({
      from: `AI Interview Prep <${defaultFrom}>`,
      to: [to],
      subject: "Reset your AI Interview Prep password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset your password</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F9FB; margin: 0; padding: 40px 20px; color: #1F2937;">
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #F3F4F6;">
                  <div style="display: inline-block; width: 40px; height: 40px; line-height: 40px; background-color: #3D6FB4; color: #FFFFFF; font-weight: bold; border-radius: 8px; font-size: 18px; margin-bottom: 12px;">AI</div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827;">Password Reset Request</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 16px; font-size: 14px; line-height: 24px; color: #4B5563;">
                    We received a request to reset the password for your AI Interview Prep candidate account.
                  </p>
                  <p style="margin: 0 0 24px; font-size: 14px; line-height: 24px; color: #4B5563;">
                    Click the button below to choose a new password. This link is single-use and will expire in <strong>20 minutes</strong>.
                  </p>
                  <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 28px;">
                    <tr>
                      <td align="center" style="border-radius: 8px; background-color: #3D6FB4;">
                        <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 0 0 12px; font-size: 12px; line-height: 18px; color: #6B7280;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p style="margin: 0 0 24px; font-size: 12px; line-height: 18px; word-break: break-all; color: #3D6FB4;">
                    <a href="${resetUrl}" style="color: #3D6FB4;">${resetUrl}</a>
                  </p>
                  <p style="margin: 0; font-size: 12px; line-height: 18px; color: #9CA3AF;">
                    If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px; background-color: #F9FAFB; border-top: 1px solid #F3F4F6; text-align: center; font-size: 11px; color: #9CA3AF;">
                  AI Interview Preparation Assistant • Automated Security Notice
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Resend Error]:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("[Email Dispatch Error]:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
