"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

let lastPathname: string | null = null;

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPathname = lastPathname;

  useEffect(() => {
    lastPathname = pathname;
  }, [pathname]);

  const transitionClass =
    previousPathname === "/wallpaper" && pathname === "/home"
      ? "page-transition-slide-up"
      : previousPathname === "/home" && pathname === "/wallpaper"
        ? "page-transition-slide-down"
        : "page-transition-spring";

  return (
    <div key={pathname} className={`page-transition-shell ${transitionClass}`}>
      {children}
    </div>
  );
}
