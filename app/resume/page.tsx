import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

export default function ResumePage() {
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
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> ATS Resume Scanner
            </CardTitle>
            <Badge variant="neutral">Coming Soon</Badge>
          </div>
          <CardDescription>
            Resume upload, ATS match scoring, keyword gap analysis, and tailored JD alignment recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-text-secondary">
            This module will support PDF/DOCX parsing and real-time ATS scoring against custom job descriptions.
          </p>
          <Link href="/interview" className="inline-block pt-2">
            <Button size="sm" className="text-xs">
              Go to Mock Interviews →
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
