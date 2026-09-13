"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  startOpenReplay,
  stopOpenReplay,
  identifyOpenReplayUser,
  trackOpenReplayEvent,
} from "@/lib/analytics/openreplay";

/**
 * Boots OpenReplay session recording and keeps it organized by role:
 * - identifies the session with the user's role/id/email as soon as it's known
 * - fires a `page_view` event (role + path) on every route change, so
 *   "most visited pages" can be filtered by role (manager/SDR/client) in
 *   the OpenReplay dashboard without hardcoding every route.
 *
 * Mounted once near the root (see components/providers/Providers.tsx) so it
 * covers every /manager, /sdr and /client surface.
 */
export function OpenReplayProvider() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const identifiedRef = useRef(false);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    startOpenReplay();
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user && !identifiedRef.current) {
      identifiedRef.current = true;
      identifyOpenReplayUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        clientId: session.user.clientId,
      });
    }

    // Session ended (logout / expiry): close out the recording so the next
    // login starts a clean session rather than inheriting a stale identity.
    if (previousStatusRef.current === "authenticated" && status === "unauthenticated") {
      identifiedRef.current = false;
      stopOpenReplay();
    }
    previousStatusRef.current = status;
  }, [status, session]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const query = searchParams?.toString();
    trackOpenReplayEvent("page_view", {
      role: session?.user?.role ?? "UNKNOWN",
      path: query ? `${pathname}?${query}` : pathname,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, status]);

  return null;
}
