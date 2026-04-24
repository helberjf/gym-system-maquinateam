"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

export function RefreshQrButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState(60);

  useEffect(() => {
    setRemaining(60);
    const interval = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(interval);
          startTransition(() => {
            router.refresh();
          });
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {remaining > 0 ? `Atualizar agora (${remaining}s)` : "Gerar novo codigo"}
    </Button>
  );
}
