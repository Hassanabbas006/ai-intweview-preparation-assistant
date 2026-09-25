"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  LogIn, 
  UserPlus, 
  Briefcase, 
  FileText, 
  Lock,
  Menu,
  X,
  Compass
} from "lucide-react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary transition-colors">
      {/* Top Navigation */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Logo & Brand Name */}
          <Link href="/" className="flex items-center space-x-2.5 sm:space-x-3 shrink-0 min-w-0">
            <div className="w-8 h-8 rounded-input bg-primary flex items-center justify-center text-white font-heading font-bold text-base sm:text-lg shrink-0 select-none shadow-soft">
              AI
            </div>
            <span className="inline sm:hidden font-heading font-bold text-sm tracking-tight text-primary-dark dark:text-primary-light whitespace-nowrap">
              Interview Prep
            </span>
            <span className="hidden sm:inline font-heading font-bold text-lg text-primary-dark dark:text-primary-light whitespace-nowrap">
              Interview Prep Assistant
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden sm:flex items-center space-x-3">
            <ThemeToggle />
            <Link href="/admin/login">
              <Button variant="ghost" size="sm" className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary">
                <Lock className="w-3.5 h-3.5" /> Admin
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <LogIn className="w-4 h-4" /> Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-soft">
                <UserPlus className="w-4 h-4" /> Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Navigation Controls */}
          <div className="flex sm:hidden items-center space-x-2 shrink-0">
            <ThemeToggle />
            <Link href="/signup">
              <Button variant="primary" size="sm" className="h-9 px-3 text-xs shadow-soft font-semibold">
                Get Started
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="w-9 h-9 flex items-center justify-center rounded-input border border-border bg-surface text-text-primary hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary select-none"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border bg-surface/98 backdrop-blur-md px-4 py-4 space-y-3 shadow-lg animate-fade-in">
            <div className="space-y-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block">
                <Button variant="outline" className="w-full justify-start text-xs h-10 gap-2">
                  <LogIn className="w-4 h-4 text-primary" /> Candidate Sign In
                </Button>
              </Link>
              <Link href="/interview" onClick={() => setMobileMenuOpen(false)} className="block">
                <Button variant="outline" className="w-full justify-start text-xs h-10 gap-2 border-primary/30 text-primary hover:bg-primary/10">
                  <Briefcase className="w-4 h-4" /> Adaptive Mock Interviews
                </Button>
              </Link>
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-text-secondary">
              <Link
                href="/admin/login"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-primary flex items-center gap-1.5 py-1"
              >
                <Lock className="w-3.5 h-3.5 text-warning" /> Admin Portal
              </Link>
              <Link
                href="/resume"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-primary flex items-center gap-1.5 py-1"
              >
                <FileText className="w-3.5 h-3.5 text-secondary" /> Resume Scanner
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto py-4 sm:py-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen AI Interview & ATS Platform
          </div>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-primary-dark dark:text-primary-light leading-tight">
            Master Technical & HR Interviews with Real-Time AI
          </h1>
          <p className="text-sm sm:text-lg text-text-secondary leading-relaxed">
            Practice adaptive mock interviews across HR, Aptitude, Managerial, and Domain tracks with real-time feedback, ATS resume optimization, and multi-factor security.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-4">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-soft text-sm sm:text-base px-6 sm:px-8 h-11 sm:h-12">
                Start Practicing Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm sm:text-base px-6 sm:px-8 h-11 sm:h-12">
                Candidate Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 pt-2">
          <Link href="/interview" className="block group">
            <Card className="h-full hover:border-primary transition-all shadow-soft group-hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-input bg-primary/10 text-primary w-fit group-hover:bg-primary group-hover:text-white transition-colors">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <Badge variant="success">Available Now</Badge>
                </div>
                <CardTitle className="text-lg mt-3 group-hover:text-primary transition-colors">Adaptive Mock Interviews</CardTitle>
                <CardDescription>
                  Simulate real technical and behavioral interviews with token-by-token streaming, contextual follow-ups, and tailored rubrics.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="hover:border-primary/40 transition-colors shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-input bg-secondary/10 text-secondary w-fit">
                  <FileText className="w-5 h-5" />
                </div>
                <Badge variant="neutral">Coming Soon</Badge>
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
                <Badge variant="success">Available Now</Badge>
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
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-2">
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
