"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldCheck, ShieldAlert, LogOut, ArrowRight, UserCheck, Briefcase, FileText, Code2 } from "lucide-react";
import { getDomainLabel } from "@/lib/constants/domains";

export default function UserDashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <p className="text-sm text-text-secondary animate-pulse">Loading dashboard session...</p>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="min-h-screen bg-background p-6 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-border gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-text-primary">Candidate Dashboard</h1>
            <p className="text-sm text-text-secondary mt-1">
              Welcome back, <span className="font-medium text-text-primary">{user?.email || "Candidate"}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Profile & Security overview card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Account Profile</CardTitle>
                <Badge variant="secondary">{user?.role || "USER"}</Badge>
              </div>
              <CardDescription>Your registered candidate profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                <span className="text-text-secondary flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" /> Email
                </span>
                <span className="font-mono text-text-primary">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50 text-sm">
                <span className="text-text-secondary flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> Target Track / Domain
                </span>
                <span className="font-medium text-text-primary">{getDomainLabel(user?.domain)}</span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-text-secondary flex items-center gap-2">
                  {user?.twoFactorEnabled ? (
                    <ShieldCheck className="w-4 h-4 text-success" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-warning" />
                  )}
                  Two-Factor Authentication (TOTP)
                </span>
                {user?.twoFactorEnabled ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="warning">Optional / Disabled</Badge>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-2 border-t border-border flex justify-end">
              <Link href="/dashboard/settings/security">
                <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs">
                  Account & Security Settings <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Quick Security Summary Card */}
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg">Account Security</CardTitle>
              <CardDescription>Multi-factor protection status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-text-secondary leading-relaxed">
                Protect your mock interview data, evaluations, and resume reports with time-based one-time password (TOTP) 2FA compatible with Google Authenticator.
              </p>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border">
              <Link href="/dashboard/settings/security" className="w-full">
                <Button variant={user?.twoFactorEnabled ? "outline" : "primary"} size="sm" className="w-full text-xs">
                  {user?.twoFactorEnabled ? "Manage 2FA" : "Enable 2FA"}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>

        {/* Phase Navigation Cards */}
        <div className="pt-4">
          <h2 className="text-lg font-bold font-heading text-text-primary mb-4">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" /> Mock Interview Engine
                  </CardTitle>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <CardDescription>
                  Interactive AI-led technical & behavioral interviews with real-time feedback.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Link href="/interview" className="w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Open Interview Hub
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> ATS Resume Scanner
                  </CardTitle>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <CardDescription>
                  Upload your resume and get match scores, keyword gap analysis, and tailored fixes.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Link href="/resume" className="w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Analyze Resume
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-primary" /> Coding Arena
                  </CardTitle>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <CardDescription>
                  Monaco-powered coding sandbox with automated test case evaluation.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Link href="/coding-arena" className="w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    Launch Arena
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
