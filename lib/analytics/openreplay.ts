// ============================================
// OpenReplay — self-hosted session replay
// ============================================
// Records sessions (with automatic page/navigation tracking) and lets us
// tag custom business events, all filterable by role in the OpenReplay
// dashboard at https://openreplay.suzaliconseil.com.
//
// Session identification and role/page tracking live in
// components/providers/OpenReplayProvider.tsx. This module only owns the
// tracker singleton and the low-level primitives it (and lib/analytics/umami.ts)
// call into.

import Tracker from "@openreplay/tracker";
import type { UserRole } from "@prisma/client";
import { config } from "@/lib/config";

let tracker: Tracker | null = null;
let started = false;

function getTracker(): Tracker | null {
  if (typeof window === "undefined") return null;
  if (!config.integrations.openreplay.enabled) return null;

  if (!tracker) {
    tracker = new Tracker({
      projectKey: config.integrations.openreplay.projectKey,
      ingestPoint: config.integrations.openreplay.ingestPoint,
      // CRM data is sensitive by default: mask free-text input content
      // (names/emails/notes typed into forms) while still recording clicks,
      // navigation and structure.
      obscureTextEmails: true,
      obscureTextNumbers: true,
    });
  }

  return tracker;
}

/** Starts session recording. Safe to call multiple times (no-op after the first). */
export function startOpenReplay() {
  const t = getTracker();
  if (!t || started) return;
  started = true;
  t.start().catch(() => {
    // Recording is best-effort; a failed start should never break the app.
    started = false;
  });
}

/** Ends the current recording, e.g. on logout so the next login starts a fresh session. */
export function stopOpenReplay() {
  if (!tracker || !started) return;
  tracker.stop();
  started = false;
}

export interface OpenReplayIdentity {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  clientId?: string | null;
}

/** Tags the active recording with who's using the app, for role-based filtering. */
export function identifyOpenReplayUser(user: OpenReplayIdentity) {
  const t = getTracker();
  if (!t) return;
  t.setUserID(user.email);
  t.setMetadata("role", user.role);
  t.setMetadata("userId", user.id);
  if (user.name) t.setMetadata("name", user.name);
  if (user.clientId) t.setMetadata("clientId", user.clientId);
}

/** Fires a named custom event into the current recording. Never throws. */
export function trackOpenReplayEvent(name: string, payload?: Record<string, unknown>) {
  const t = getTracker();
  if (!t) return;
  try {
    t.event(name, payload ?? {});
  } catch {
    // Analytics should never break the app.
  }
}
