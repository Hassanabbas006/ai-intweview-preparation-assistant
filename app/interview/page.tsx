"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { DOMAIN_OPTIONS } from "@/lib/constants/domains";
import {
  Briefcase,
  Users,
  BrainCircuit,
  Calculator,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  History,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface TrackCardOption {
  type: "HR" | "DOMAIN" | "MANAGERIAL" | "APTITUDE";
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

const TRACKS: TrackCardOption[] = [
  {
    type: "DOMAIN",
    title: "Technical / Domain Deep Dive",
    subtitle: "Architecture, coding trade-offs, and systems",
    description: "Rigorous technical discussion tailored to your engineering discipline with live follow-ups.",
    icon: BrainCircuit,
    tag: "Most Popular",
  },
  {
    type: "HR",
    title: "HR & Behavioral Round",
    subtitle: "Culture, collaboration, STAR method",
    description: "Practice answering situational questions, handling team conflict, and articulating career growth.",
    icon: Users,
    tag: "Core Round",
  },
  {
    type: "MANAGERIAL",
    title: "Managerial & Leadership",
    subtitle: "Strategy, delegation, scaling teams",
    description: "Evaluate your decision-making under ambiguity, roadmap prioritization, and mentorship.",
    icon: Briefcase,
    tag: "Senior / Lead",
  },
  {
    type: "APTITUDE",
    title: "Aptitude Assessment",
    subtitle: "Quantitative, logical, and verbal",
    description: "Timed, objectively-scored test with real-time accuracy scoring and detailed explanations.",
    icon: Calculator,
    tag: "Timed Test",
  },
];

const DIFFICULTY_LEVELS = [
  { value: "JUNIOR", label: "Junior (0–2 yrs)" },
  { value: "INTERMEDIATE", label: "Mid-Level (2–5 yrs)" },
  { value: "SENIOR", label: "Senior (5–8 yrs)" },
  { value: "LEAD", label: "Staff / Lead (8+ yrs)" },
];

export default function InterviewHubPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [selectedTrack, setSelectedTrack] = useState<"HR" | "DOMAIN" | "MANAGERIAL" | "APTITUDE">("DOMAIN");
  const [selectedDomain, setSelectedDomain] = useState<string>("Fullstack");
  const [focusArea, setFocusArea] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("INTERMEDIATE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync domain preference from session
  useEffect(() => {
    if (session?.user?.domain) {
      setSelectedDomain(session.user.domain);
    }
  }, [session?.user?.domain]);

  const handleStartInterview = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedTrack,
          domain: selectedTrack === "DOMAIN" ? selectedDomain : null,
          focusArea: selectedTrack === "DOMAIN" ? focusArea : null,
          difficulty,
          modality: "TEXT",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || "Failed to initialize interview session.");
        setLoading(false);
        return;
      }

      // Navigate to active interview room
      router.push(`/interview/${data.data.sessionId}`);
    } catch {
      setError("Network or server error while starting interview.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary p-4 sm:p-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <ThemeToggle />
        </div>

        {/* Page Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> AI Mock Interview Engine
          </div>
          <h1 className="text-3xl font-bold font-heading text-text-primary tracking-tight">
            Configure Your Mock Interview
          </h1>
          <p className="text-sm text-text-secondary max-w-2xl">
            Choose an interview track, customize technical focus areas, and practice with real-time AI responses and adaptive follow-ups.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-input bg-error/15 border border-error/30 text-error text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Select Track */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
            Select Interview Track
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TRACKS.map((track) => {
              const Icon = track.icon;
              const isSelected = selectedTrack === track.type;
              return (
                <button
                  key={track.type}
                  type="button"
                  onClick={() => setSelectedTrack(track.type)}
                  className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-soft ring-2 ring-primary/30"
                      : "border-border bg-surface hover:border-primary/50 hover:bg-surface/80"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-input ${isSelected ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant={isSelected ? "primary" : "neutral"} className="text-[10px]">
                        {track.tag}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-sm text-text-primary">{track.title}</h3>
                      <p className="text-[11px] text-text-secondary mt-0.5">{track.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary mt-4 leading-relaxed line-clamp-3">
                    {track.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Track Options & Customization */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Layers className="w-5 h-5" />
              <CardTitle className="text-lg">
                Customize Round Parameters
              </CardTitle>
            </div>
            <CardDescription>
              Tailor the difficulty, engineering stack, and focus topics for this session.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Seniority / Difficulty */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Target Seniority / Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-sm bg-surface text-text-primary border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary shadow-soft"
                >
                  {DIFFICULTY_LEVELS.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Domain selector (if DOMAIN track selected) */}
              {selectedTrack === "DOMAIN" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">Engineering Discipline / Domain</label>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="w-full h-10 px-3 py-2 text-sm bg-surface text-text-primary border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary shadow-soft"
                  >
                    {DOMAIN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">Session Mode</label>
                  <div className="p-2.5 rounded-input bg-background border border-border text-xs text-text-secondary flex items-center justify-between">
                    <span>Text-based Interactive Chat</span>
                    <Badge variant="success">Active</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Focus Area (for Domain track) */}
            {selectedTrack === "DOMAIN" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">
                  Specific Focus Topics <span className="font-normal text-text-secondary/70">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. React Performance, PostgreSQL Indexing, Microservices Architecture, Kafka"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  maxLength={100}
                  className="w-full h-10 px-3 py-2 text-sm bg-surface text-text-primary border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary shadow-soft"
                />
                <p className="text-[11px] text-text-secondary">
                  The AI interviewer will adapt its questions and architectural scenarios to probe these specific technologies.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border pt-4">
            <div className="text-xs text-text-secondary flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>Session responses stream in real-time token-by-token.</span>
            </div>

            <Button
              onClick={handleStartInterview}
              disabled={loading}
              size="lg"
              className="w-full sm:w-auto flex items-center gap-2 shadow-soft font-semibold"
            >
              {loading ? (
                <>Initializing Interview Room...</>
              ) : (
                <>
                  Start Interview Session <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
