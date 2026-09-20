"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  LogIn, 
  UserPlus, 
  Briefcase, 
  FileText, 
  Code2, 
  Lock 
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary transition-colors">
      {/* Top Navigation */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-input bg-primary flex items-center justify-center text-white font-heading font-bold text-lg">
              AI
            </div>
            <span className="font-heading font-bold text-lg text-primary-dark dark:text-primary-light">
              Interview Prep Assistant
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Link href="/admin/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary">
                <Lock className="w-3.5 h-3.5" /> Admin
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <LogIn className="w-4 h-4" /> Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm" className="flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" /> Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Interview & ATS Platform
          </div>
          <h1 className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight text-primary-dark dark:text-primary-light">
            Master Technical & HR Interviews with Real-Time AI
          </h1>
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
            Practice adaptive mock interviews across HR, Aptitude, Managerial, and Domain tracks with real-time feedback, ATS resume optimization, and multi-factor security.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/signup">
              <Button size="lg" className="flex items-center gap-2 shadow-soft text-base px-8">
                Start Practicing Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="flex items-center gap-2 text-base px-8">
                Candidate Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Card className="hover:border-primary/40 transition-colors shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-input bg-primary/10 text-primary w-fit">
                  <Briefcase className="w-5 h-5" />
                </div>
                <Badge variant="primary">Phase 2</Badge>
              </div>
              <CardTitle className="text-lg mt-3">Adaptive Mock Interviews</CardTitle>
              <CardDescription>
                Simulate real technical and behavioral interviews with token-by-token streaming, contextual follow-ups, and tailored rubrics.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-primary/40 transition-colors shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-input bg-secondary/10 text-secondary w-fit">
                  <FileText className="w-5 h-5" />
                </div>
                <Badge variant="secondary">Phase 4</Badge>
              </div>
              <CardTitle className="text-lg mt-3">ATS Resume Scanner</CardTitle>
              <CardDescription>
                Upload your resume for job-targeted or general ATS scoring, keyword gap identification, and structural suggestions.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:border-primary/40 transition-colors shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-input bg-primary/10 text-primary w-fit">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <Badge variant="success">Phase 1 Complete</Badge>
              </div>
              <CardTitle className="text-lg mt-3">Secure Multi-Factor Auth</CardTitle>
              <CardDescription>
                Google OAuth, email/password authentication, Google Authenticator TOTP 2FA, and isolated zero-IP admin security.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Links Section */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-base">Quick Portal Navigation</CardTitle>
            <CardDescription>Direct shortcuts to application entry points</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/login" className="p-4 rounded-input border border-border hover:border-primary transition-colors bg-background flex flex-col justify-between">
              <div>
                <p className="font-semibold text-sm text-text-primary">Candidate Login</p>
                <p className="text-xs text-text-secondary mt-1">Sign in with Email/Password or Google OAuth</p>
              </div>
              <span className="text-xs text-primary font-medium mt-3 flex items-center gap-1">Open Login →</span>
            </Link>

            <Link href="/signup" className="p-4 rounded-input border border-border hover:border-primary transition-colors bg-background flex flex-col justify-between">
              <div>
                <p className="font-semibold text-sm text-text-primary">Candidate Registration</p>
                <p className="text-xs text-text-secondary mt-1">Create an account and choose your career domain</p>
              </div>
              <span className="text-xs text-primary font-medium mt-3 flex items-center gap-1">Sign Up →</span>
            </Link>

            <Link href="/admin/login" className="p-4 rounded-input border border-border hover:border-primary transition-colors bg-background flex flex-col justify-between">
              <div>
                <p className="font-semibold text-sm text-text-primary flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-warning" /> Admin Portal
                </p>
                <p className="text-xs text-text-secondary mt-1">Privileged access with mandatory 2FA</p>
              </div>
              <span className="text-xs text-primary font-medium mt-3 flex items-center gap-1">Admin Access →</span>
            </Link>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-text-secondary mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Interview Preparation Assistant</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-primary transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-primary transition-colors">Signup</Link>
            <Link href="/admin/login" className="hover:text-primary transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
