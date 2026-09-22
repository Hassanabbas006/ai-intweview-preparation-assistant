"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Briefcase,
  Save,
} from "lucide-react";
import { DOMAIN_OPTIONS, getDomainLabel } from "@/lib/constants/domains";

export default function SecuritySettingsPage() {
  const { data: session, update, status } = useSession();

  // Domain state
  const [selectedDomain, setSelectedDomain] = useState<string>("Software_Engineering");
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // 2FA state
  const [setupStep, setSetupStep] = useState<"idle" | "qr_ready" | "success">("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync domain from session once loaded
  useEffect(() => {
    if (session?.user?.domain) {
      setSelectedDomain(session.user.domain);
    }
  }, [session?.user?.domain]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <p className="text-sm text-text-secondary animate-pulse">Loading account settings...</p>
      </div>
    );
  }

  const is2FAActive = session?.user?.twoFactorEnabled;

  // Handle Domain Update
  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setDomainError(null);
    setDomainSuccess(null);
    setDomainLoading(true);

    try {
      const res = await fetch("/api/user/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: selectedDomain }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setDomainError(data.message || "Failed to update target domain.");
        setDomainLoading(false);
        return;
      }

      // Update client session token
      await update({ domain: selectedDomain });

      const domainLabel =
        DOMAIN_OPTIONS.find((d) => d.value === selectedDomain)?.label || selectedDomain;
      setDomainSuccess(`Target track successfully updated to ${domainLabel}.`);
      setDomainLoading(false);
    } catch {
      setDomainError("Network error while updating target domain.");
      setDomainLoading(false);
    }
  };

  // Handle 2FA Setup Initiation
  const handleStartSetup = async () => {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Failed to start 2FA setup.");
        setLoading(false);
        return;
      }

      setQrCodeUrl(data.data.qrCodeUrl);
      setSecret(data.data.secret);
      setSetupStep("qr_ready");
      setLoading(false);
    } catch {
      setError("Network error while initiating 2FA setup.");
      setLoading(false);
    }
  };

  // Handle 2FA Verification
  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Invalid verification code.");
        setLoading(false);
        return;
      }

      // Update client session token
      await update({ twoFactorEnabled: true });

      setSetupStep("success");
      setSuccessMessage("Two-factor authentication has been successfully activated!");
      setLoading(false);
    } catch {
      setError("Network error during verification.");
      setLoading(false);
    }
  };

  // Handle 2FA Disable
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Failed to disable 2FA.");
        setLoading(false);
        return;
      }

      await update({ twoFactorEnabled: false });

      setShowDisableConfirm(false);
      setDisablePassword("");
      setSetupStep("idle");
      setSuccessMessage("Two-factor authentication has been disabled.");
      setLoading(false);
    } catch {
      setError("Network error during request.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 transition-colors">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <ThemeToggle />
        </div>

        <div>
          <h1 className="text-2xl font-bold font-heading text-text-primary">
            Account & Security Settings
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your career interview track, profile preferences, and multi-factor authentication.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* Section 1: Target Track / Domain */}
        {/* ========================================================================= */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" /> Target Track / Career Domain
              </CardTitle>
              <Badge variant="neutral">
                {getDomainLabel(session?.user?.domain)}
              </Badge>
            </div>
            <CardDescription>
              Personalize your mock interview question bank, evaluation rubrics, and ATS resume scanning focus.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {domainError && (
              <div className="mb-4 p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
                {domainError}
              </div>
            )}

            {domainSuccess && (
              <div className="mb-4 p-3 rounded-input bg-success/15 border border-success/30 text-success text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {domainSuccess}
              </div>
            )}

            <form onSubmit={handleSaveDomain} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Primary Discipline / Track
                </label>
                <select
                  value={selectedDomain}
                  onChange={(e) => {
                    setSelectedDomain(e.target.value);
                    setDomainSuccess(null);
                    setDomainError(null);
                  }}
                  disabled={domainLoading}
                  className="w-full h-10 px-3 py-2 text-sm bg-surface text-text-primary border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                >
                  {DOMAIN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-secondary mt-1">
                  You can change this track anytime. Interview simulations will adapt accordingly.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={domainLoading || selectedDomain === session?.user?.domain}
                  className="flex items-center gap-2 text-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  {domainLoading ? "Saving..." : "Save Track Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ========================================================================= */}
        {/* Section 2: Two-Factor Authentication (2FA) */}
        {/* ========================================================================= */}
        {error && (
          <div className="p-3 rounded-input bg-error/15 border border-error/30 text-error text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-input bg-success/15 border border-success/30 text-success text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {successMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" /> Two-Factor Authentication (2FA)
              </CardTitle>
              {is2FAActive ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <Badge variant="warning">Disabled</Badge>
              )}
            </div>
            <CardDescription>
              {is2FAActive
                ? "Your candidate account is currently protected with time-based one-time password (TOTP) 2FA."
                : "Candidate 2FA is optional but strongly recommended to safeguard your evaluations."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {!is2FAActive && setupStep === "idle" && (
              <div className="space-y-4">
                <div className="p-4 rounded-card bg-surface border border-border space-y-2">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" /> How it works
                  </h3>
                  <ol className="text-xs text-text-secondary space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Click below to generate your unique authenticator QR code.</li>
                    <li>Scan the QR code with Google Authenticator or your password manager.</li>
                    <li>Enter the 6-digit code shown in your app to activate 2FA.</li>
                  </ol>
                </div>

                <Button onClick={handleStartSetup} disabled={loading} className="w-full">
                  {loading ? "Generating secret..." : "Enable Two-Factor Authentication"}
                </Button>
              </div>
            )}

            {!is2FAActive && setupStep === "qr_ready" && qrCodeUrl && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-card border border-border w-fit mx-auto shadow-soft">
                  <Image
                    src={qrCodeUrl}
                    alt="2FA QR Code"
                    width={192}
                    height={192}
                    className="w-48 h-48"
                    unoptimized
                  />
                  <p className="text-[11px] text-gray-500 font-mono mt-2">
                    Scan with your Authenticator App
                  </p>
                </div>

                {secret && (
                  <div className="p-3 bg-surface border border-border rounded-input text-center space-y-1">
                    <p className="text-xs text-text-secondary">Can&apos;t scan? Enter key manually:</p>
                    <code className="text-xs font-mono font-bold text-primary select-all tracking-wider">
                      {secret}
                    </code>
                  </div>
                )}

                <form onSubmit={handleVerifySetup} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-secondary">
                      Enter 6-Digit Code from App
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="123456"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="text-center tracking-widest text-lg font-mono"
                      required
                      autoFocus
                      disabled={loading}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSetupStep("idle")}
                      disabled={loading}
                      className="w-1/3"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="w-2/3">
                      {loading ? "Verifying..." : "Verify & Activate"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {is2FAActive && (
              <div className="space-y-4">
                <div className="p-4 rounded-card bg-success/10 border border-success/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-text-primary">
                      2FA is actively protecting your account
                    </p>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Every time you log in with your password, you will be prompted for a 6-digit TOTP verification code.
                    </p>
                  </div>
                </div>

                {!showDisableConfirm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowDisableConfirm(true)}
                    className="text-error border-error/30 hover:bg-error/10 text-xs"
                  >
                    Disable Two-Factor Authentication
                  </Button>
                ) : (
                  <form
                    onSubmit={handleDisable2FA}
                    className="p-4 border border-border rounded-card space-y-3 bg-surface"
                  >
                    <p className="text-xs font-medium text-text-primary">
                      Confirm password to disable 2FA:
                    </p>
                    <PasswordInput
                      placeholder="Your account password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDisableConfirm(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={loading}
                      >
                        {loading ? "Disabling..." : "Confirm & Disable"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
