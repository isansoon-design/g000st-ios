"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function HeaderPortal({ children, slotId }: { children: ReactNode; slotId: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(slotId));
  }, [slotId]);

  return target ? createPortal(children, target) : null;
}

export function UserHeaderPortal({ children }: { children: ReactNode }) {
  return <HeaderPortal slotId="user-page-header-slot">{children}</HeaderPortal>;
}

export function AdminHeaderPortal({ children }: { children: ReactNode }) {
  return <HeaderPortal slotId="admin-page-header-slot">{children}</HeaderPortal>;
}
