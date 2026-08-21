import { useState } from "react";
import { AlertCircle, LogOut } from "lucide-react";
import { useGame } from "../../context/GameContext";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { cn } from "../../lib/utils";

interface WithdrawLinkProps {
  variant?: "minimal" | "dock";
}

export default function WithdrawLink({ variant = "minimal" }: WithdrawLinkProps) {
  const { state, revokeSession } = useGame();
  const [open, setOpen] = useState(false);

  const hiddenStatuses = ["loading", "complete", "revoked", "underage", "error"];
  if (!state.session || hiddenStatuses.includes(state.status)) return null;

  const handleWithdraw = () => {
    revokeSession("user_request");
    setOpen(false);
  };

  const trigger =
    variant === "dock" ? (
      <Button
        variant="ghost"
        size="sm"
        className="text-[var(--color-surface-500)] hover:text-[var(--color-crit-600)] hover:bg-[var(--color-crit-50)]"
      >
        <LogOut className="mr-2 h-3.5 w-3.5" />
        Teilnahme beenden
      </Button>
    ) : (
      <button
        className="text-xs text-[var(--color-surface-500)] transition-colors hover:text-[var(--color-surface-400)] hover:underline"
        title="Studie beenden und Daten zur Löschung vormerken"
      >
        Teilnahme beenden
      </button>
    );

  return (
    <div
      className={cn(
        variant === "minimal" && "fixed bottom-4 right-4 z-40",
        variant === "dock" && "contents"
      )}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[var(--color-crit-600)]">
              <AlertCircle className="h-5 w-5" />
              <DialogTitle>Teilnahme beenden?</DialogTitle>
            </div>
            <DialogDescription>
              Sie stehen im Begriff, die Studie vorzeitig zu verlassen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-surface-200)] bg-[var(--color-surface-50)] p-4">
              <p className="text-sm leading-relaxed text-[var(--color-surface-700)]">
                Ihre Session wird beendet und Ihre Daten werden als{" "}
                <strong className="text-[var(--color-surface-900)]">
                  "zur Löschung vorgemerkt"
                </strong>{" "}
                markiert.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-surface-500)]">
                Ihre Teilnahme-ID
              </p>
              <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-100)] px-3 py-2">
                <code className="font-mono text-sm font-semibold text-[var(--color-brand-700)]">
                  {state.session.participantId}
                </code>
              </div>
              <p className="text-[11px] leading-normal text-[var(--color-surface-500)]">
                Bitte notieren Sie sich diese ID, falls Sie eine vollständige Löschung
                innerhalb von 30 Tagen beantragen möchten.
              </p>
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Zurück zur Studie
            </Button>
            <Button variant="destructive" onClick={handleWithdraw}>
              Teilnahme beenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
