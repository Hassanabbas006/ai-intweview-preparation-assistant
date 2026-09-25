import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Monitor } from "lucide-react";

export default function CodingArenaPage() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/dashboard" className="p-1.5 rounded-input hover:bg-surface text-text-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="text-xs text-text-secondary">Back to Dashboard</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg sm:text-xl">Coding Arena</CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            Monaco code editor, algorithmic & domain problem bank, and automated test execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3.5 rounded-input bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2.5">
            <Monitor className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Desktop-Optimized Feature</p>
              <p className="text-text-secondary mt-0.5">
                The multi-file Monaco code editor and side-by-side test terminal are designed for desktop monitors. All other interview and ATS features are fully mobile responsive.
              </p>
            </div>
          </div>
          <Link href="/interview" className="inline-block pt-2">
            <Button size="sm" className="text-xs">
              Try Adaptive Mock Interviews →
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
