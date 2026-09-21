"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lock, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-error mb-1">
            <AlertCircle className="w-5 h-5" />
            <CardTitle>Invalid Reset Link</CardTitle>
          </div>
          <CardDescription>
            No reset token was provided in the link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            The link you followed is incomplete or invalid. Please request a fresh password reset link.
          </p>
          <Link href="/forgot-password" className="block w-full">
            <Button variant="primary" className="w-full text-xs">
              Request New Reset Link
            </Button>
          </Link>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border pt-4">
          <Link href="/login" className="text-xs text-text-secondary hover:text-primary transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Failed to reset password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to login with success indicator
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 2000);
    } catch {
      setError("Network or server error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary mb-1">
          <Lock className="w-5 h-5" />
          <CardTitle>Set New Password</CardTitle>
        </div>
        <CardDescription>
          Enter your new password below. It must be at least 8 characters long.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {success ? (
          <div className="p-4 rounded-input bg-success/10 border border-success/30 text-text-primary text-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-success">Password Reset Complete</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Your password has been updated successfully. Redirecting you to sign in...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">New Password</label>
              <PasswordInput
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">Confirm New Password</label>
              <PasswordInput
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating password..." : "Update Password"}
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
  );
}

export default function ResetPasswordPage() {
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
            Choose a New Password
          </p>
        </div>

        <Suspense fallback={<div className="text-sm text-text-secondary text-center">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
