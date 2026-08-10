import { v } from "convex/values";

// Shared email type registry: one place for the union, the validator, and
// the per-type toggle defaults used by the admin Email dashboard. Every
// send routes through emails/resend.sendEmail which enforces these toggles
// (always subordinate to the global emailsEnabled master switch).

export const EMAIL_TYPES = [
  "daily_admin",
  "daily_engagement",
  "welcome",
  "message_notification",
  "weekly_digest",
  "mention_notification",
  "admin_broadcast",
  "admin_report_notification",
  "admin_user_report_notification",
  "spam_notification",
  "submission_confirmation",
  "submission_admin_alert",
  "results_live",
  "judging_group",
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

// Convex validator matching EMAIL_TYPES (schema, sendEmail, and settings all
// share this so the unions can never drift apart)
export const emailTypeValidator = v.union(
  v.literal("daily_admin"),
  v.literal("daily_engagement"),
  v.literal("welcome"),
  v.literal("message_notification"),
  v.literal("weekly_digest"),
  v.literal("mention_notification"),
  v.literal("admin_broadcast"),
  v.literal("admin_report_notification"),
  v.literal("admin_user_report_notification"),
  v.literal("spam_notification"),
  v.literal("submission_confirmation"),
  v.literal("submission_admin_alert"),
  v.literal("results_live"),
  v.literal("judging_group"),
);

// Effective value when no appSettings row exists for a type. Existing types
// default on (no behavior change); the new submission types default off.
export const EMAIL_TYPE_DEFAULTS: Record<EmailType, boolean> = {
  daily_admin: true,
  daily_engagement: true,
  welcome: true,
  message_notification: true,
  weekly_digest: true,
  mention_notification: true,
  admin_broadcast: true,
  admin_report_notification: true,
  admin_user_report_notification: true,
  spam_notification: true,
  submission_confirmation: false,
  submission_admin_alert: false,
  results_live: false,
  // Organizer emails to judges from a judging group; off until an admin
  // explicitly enables the feature in Email Send Options.
  judging_group: false,
};

// appSettings key for one email type's toggle (valueBoolean row)
export function emailTypeSettingKey(emailType: EmailType): string {
  return `emailTypeEnabled:${emailType}`;
}
