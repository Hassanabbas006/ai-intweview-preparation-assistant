import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface EndDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isEnding?: boolean;
}

export function EndDialog({
  isOpen,
  onClose,
  onConfirm,
  isEnding,
}: EndDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-3 text-warning">
          <div className="p-2 rounded-full bg-warning/15">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold font-heading text-text-primary">
            Conclude Interview Session?
          </h2>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed">
          Are you sure you want to end this interview? Your complete conversation transcript will be saved to your dashboard.
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isEnding}
          >
            Continue Interview
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            isLoading={isEnding}
            loadingText="Concluding..."
          >
            End Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
