import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CodingArenaPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Coding Arena</CardTitle>
            <Badge variant="primary">Phase 7</Badge>
          </div>
          <CardDescription>
            Monaco editor, problem bank, and Judge0/Piston code runner will be implemented in Phase 7.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
