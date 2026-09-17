"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { CheckCircle2, ShieldAlert, Sparkles, Terminal, FileText, MessagesSquare } from "lucide-react";

export default function Home() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  return (
    <div className="min-h-screen flex flex-col">
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
            <Badge variant="primary">Phase 0: Foundation</Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Hero Banner */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-primary-dark dark:text-primary-light">
            Foundation & Design System
          </h1>
          <p className="text-base text-text-secondary max-w-3xl">
            Phase 0 setup complete. Next.js App Router, Tailwind CSS design tokens, Prisma ORM schema,
            and accessible UI components adhering to the calm and trustworthy visual direction.
          </p>
        </div>

        {/* Foundation Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2 text-primary">
                <Terminal className="h-5 w-5" />
                <CardTitle>Architecture</CardTitle>
              </div>
              <CardDescription>Directory scaffolding & Next.js 14</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-text-secondary text-xs">
              <div className="flex items-center justify-between">
                <span>App Router structure</span>
                <Badge variant="success">Configured</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Standard API handler</span>
                <Badge variant="success">Enforced</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>GitHub Actions CI</span>
                <Badge variant="success">Ready</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2 text-secondary">
                <ShieldAlert className="h-5 w-5" />
                <CardTitle>Database & Security</CardTitle>
              </div>
              <CardDescription>PostgreSQL schema with Prisma</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-text-secondary text-xs">
              <div className="flex items-center justify-between">
                <span>7 Core tables modeled</span>
                <Badge variant="success">Ready</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Separate Admin entity</span>
                <Badge variant="success">Isolated</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>IP tracking guardrail</span>
                <Badge variant="success">Zero-IP Enforced</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <CardTitle>Design Tokens</CardTitle>
              </div>
              <CardDescription>Calm & trustworthy palette</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-text-secondary text-xs">
              <div className="flex items-center justify-between">
                <span>Light & Dark mode</span>
                <Badge variant="success">Interactive</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Manrope & Inter fonts</span>
                <Badge variant="success">Loaded</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>8px / 12px radii tokens</span>
                <Badge variant="success">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Interactive UI Kit Showcase */}
        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>UI Kit Component Verification</CardTitle>
            <CardDescription>
              Test interactive buttons, inputs, modal dialogs, and color tokens.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Buttons & Modal trigger */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Buttons (Variants & Sizes)
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="md">
                  Primary Action
                </Button>
                <Button variant="secondary" size="md">
                  Secondary Action
                </Button>
                <Button variant="outline" size="md">
                  Outline
                </Button>
                <Button variant="ghost" size="md">
                  Ghost
                </Button>
                <Button variant="destructive" size="md">
                  Destructive (Muted Coral)
                </Button>
                <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
                  Open Modal Preview
                </Button>
              </div>
            </div>

            {/* Inputs & Form Controls */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Form Inputs
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    Test Input Field
                  </label>
                  <Input
                    placeholder="Enter your target role (e.g. Software Engineer)..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    Disabled State
                  </label>
                  <Input disabled placeholder="Disabled field..." />
                </div>
              </div>
            </div>

            {/* Status Badges */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Status Badges & Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">Neutral Tag</Badge>
                <Badge variant="primary">Primary Badge</Badge>
                <Badge variant="secondary">Secondary Tag</Badge>
                <Badge variant="success">Passed / ATS 92%</Badge>
                <Badge variant="warning">Action Needed</Badge>
                <Badge variant="error">Missing Keyword</Badge>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between text-xs text-text-secondary">
            <span>Palette verified against docs/design.md tokens</span>
            <span className="font-mono text-[11px]">v0.1.0 • Foundation Ready</span>
          </CardFooter>
        </Card>

        {/* Modal Dialog */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Modal Component Preview"
          description="Accessible dialog container for prompts, confirmations, and TOTP 2FA setups."
        >
          <div className="space-y-4 text-sm text-text-secondary">
            <p>
              This dialog implements focus management, backdrop blur, escape key dismissal, and
              the 12px border radius conforming to the project design guidelines.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-text-secondary mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI Interview Preparation Assistant • Phase 0: Foundation</span>
          <span>Google Antigravity</span>
        </div>
      </footer>
    </div>
  );
}
