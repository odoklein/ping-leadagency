import { trackOpenReplayEvent } from "@/lib/analytics/openreplay";

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

export const UMAMI_EVENTS = {
  // Auth
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILURE: "login_failure",
  LOGOUT: "logout",

  // Missions
  MISSION_CREATED: "mission_created",
  MISSION_UPDATED: "mission_updated",
  MISSION_STATUS_CHANGED: "mission_status_changed",

  // Campaigns
  CAMPAIGN_CREATED: "campaign_created",
  CAMPAIGN_DUPLICATED: "campaign_duplicated",
  CAMPAIGN_STATUS_CHANGED: "campaign_status_changed",

  // SDR Actions (core outreach)
  ACTION_CREATED: "action_created",
  ACTION_UPDATED: "action_updated",
  ACTION_DELETED: "action_deleted",
  ACTION_BULK_DISQUALIFIED: "action_bulk_disqualified",
  ACTION_RESULT_CHANGED: "action_result_changed",

  // Meetings (conversion)
  MEETING_BOOKED: "meeting_booked",
  MEETING_CANCELLED: "meeting_cancelled",
  MEETING_RESCHEDULED: "meeting_rescheduled",

  // Email
  EMAIL_SENT: "email_sent",
  SEQUENCE_ENROLLED: "sequence_enrolled",
  SEQUENCE_CREATED: "sequence_created",
  SEQUENCE_ACTIVATED: "sequence_activated",

  // SDR Activity
  SDR_SESSION_START: "sdr_session_start",
  SDR_SESSION_PAUSE: "sdr_session_pause",
  SDR_DAILY_FEEDBACK: "sdr_daily_feedback",

  // Billing / Revenue
  ENGAGEMENT_CREATED: "engagement_created",
  INVOICE_CREATED: "invoice_created",
  INVOICE_GENERATED: "invoice_generated",
  INVOICE_VALIDATED: "invoice_validated",
  INVOICE_SENT: "invoice_sent",
  INVOICE_CANCELLED: "invoice_cancelled",
  PAYMENT_CONFIRMED: "payment_confirmed",
  PAYMENT_REJECTED: "payment_rejected",

  // Files
  FILE_UPLOADED: "file_uploaded",
  FILE_DOWNLOADED: "file_downloaded",

  // Portal
  CLIENT_LOGIN: "client_login",
  REPORT_VIEWED: "report_viewed",
} as const;

export type UmamiEvent = (typeof UMAMI_EVENTS)[keyof typeof UMAMI_EVENTS];

export function trackEvent(event: UmamiEvent, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Silently fail – analytics should never break the app
  }
  // Mirror every named business action into OpenReplay so it shows up
  // alongside the session recording (filterable by role via user metadata).
  trackOpenReplayEvent(event, data);
}

export function trackActionCreated(data: {
  channel: string;
  result?: string;
  missionId?: string;
  hasContact: boolean;
  hasCompany: boolean;
}) {
  trackEvent(UMAMI_EVENTS.ACTION_CREATED, data);
}

export function trackMeetingBooked(data: {
  type: "VISIO" | "PHYSIQUE" | "TELEPHONIQUE";
  hasCalendly: boolean;
  missionId?: string;
}) {
  trackEvent(UMAMI_EVENTS.MEETING_BOOKED, data);
}

export function trackInvoiceCreated(data: {
  method: "manual" | "auto";
  amount: number;
  itemCount: number;
}) {
  trackEvent(UMAMI_EVENTS.INVOICE_CREATED, data);
}

export function trackLogin(success: boolean, method?: string) {
  trackEvent(
    success ? UMAMI_EVENTS.LOGIN_SUCCESS : UMAMI_EVENTS.LOGIN_FAILURE,
    { method: method || "credentials" },
  );
}

export function trackMissionCreated(data: {
  channel: string;
  clientCount: number;
}) {
  trackEvent(UMAMI_EVENTS.MISSION_CREATED, data);
}
