"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { KeyRound, ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Failed to process password reset request.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);
    } catch {
      setError("Network or server error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background transition-colors">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-heading font-bold text-2xl text-text-primary tracking-tight">
            AI Interview Prep
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Candidate Account Recovery
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <KeyRound className="w-5 h-5" />
              <CardTitle>Forgot Password</CardTitle>
            </div>
            <CardDescription>
              Enter the email address associated with your account and we will send you a time-limited password reset link.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <div className="p-4 rounded-input bg-success/10 border border-success/30 text-text-primary text-sm flex items-start gap-3">
                  <MailCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-success">Check your email</p>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      If an account exists for <strong className="text-text-primary">{email}</strong>, a password reset link has been sent. The link expires in 20 minutes.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-text-secondary text-center">
                  Did not receive an email? Check your spam folder or try requesting again.
                </p>

                <Button
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                  }}
                >
                  Send Another Link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Email Address</label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending reset link..." : "Send Password Reset Link"}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border pt-4">
            <Link
              href="/login"
              className="text-xs text-text-secondary hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Candidate Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
