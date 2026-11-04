"use client";

import { useTransition } from "react";
import { refreshAction } from "@/lib/actions";

export function RefreshButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => refreshAction())}
      disabled={pending}
      className="btn-ghost py-1.5 text-xs"
    >
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
