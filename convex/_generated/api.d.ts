/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLog from "../activityLog.js";
import type * as admin_adminActions from "../admin/adminActions.js";
import type * as admin_forceLogout from "../admin/forceLogout.js";
import type * as adminAccess from "../adminAccess.js";
import type * as adminFollowsQueries from "../adminFollowsQueries.js";
import type * as adminJudgeTracking from "../adminJudgeTracking.js";
import type * as adminQueries from "../adminQueries.js";
import type * as agentJudges from "../agentJudges.js";
import type * as agentReady_analytics from "../agentReady/analytics.js";
import type * as agentReady_content from "../agentReady/content.js";
import type * as aiJudge from "../aiJudge.js";
import type * as aiJudgeAnalysis from "../aiJudgeAnalysis.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as clerk from "../clerk.js";
import type * as comments from "../comments.js";
import type * as convexBoxConfig from "../convexBoxConfig.js";
import type * as crons from "../crons.js";
import type * as dm from "../dm.js";
import type * as dmReactions from "../dmReactions.js";
import type * as emailSettings from "../emailSettings.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as emails_broadcast from "../emails/broadcast.js";
import type * as emails_daily from "../emails/daily.js";
import type * as emails_emailTypes from "../emails/emailTypes.js";
import type * as emails_helpers from "../emails/helpers.js";
import type * as emails_judgingGroupEmails from "../emails/judgingGroupEmails.js";
import type * as emails_linkHelpers from "../emails/linkHelpers.js";
import type * as emails_mentions from "../emails/mentions.js";
import type * as emails_queries from "../emails/queries.js";
import type * as emails_render from "../emails/render.js";
import type * as emails_reports from "../emails/reports.js";
import type * as emails_resend from "../emails/resend.js";
import type * as emails_spam from "../emails/spam.js";
import type * as emails_submissions from "../emails/submissions.js";
import type * as emails_templates from "../emails/templates.js";
import type * as emails_unsubscribe from "../emails/unsubscribe.js";
import type * as emails_weekly from "../emails/weekly.js";
import type * as emails_welcome from "../emails/welcome.js";
import type * as follows from "../follows.js";
import type * as forms from "../forms.js";
import type * as hackathon from "../hackathon.js";
import type * as hackathonLog from "../hackathonLog.js";
import type * as http from "../http.js";
import type * as judgeScores from "../judgeScores.js";
import type * as judges from "../judges.js";
import type * as judgingCriteria from "../judgingCriteria.js";
import type * as judgingGroupSubmissions from "../judgingGroupSubmissions.js";
import type * as judgingGroups from "../judgingGroups.js";
import type * as mentions from "../mentions.js";
import type * as migrations from "../migrations.js";
import type * as reports from "../reports.js";
import type * as sendEmails from "../sendEmails.js";
import type * as settings from "../settings.js";
import type * as siteDirectory from "../siteDirectory.js";
import type * as siteFiles from "../siteFiles.js";
import type * as spamCheck from "../spamCheck.js";
import type * as spamCheckAnalysis from "../spamCheckAnalysis.js";
import type * as stories from "../stories.js";
import type * as storyFormFields from "../storyFormFields.js";
import type * as storyRatings from "../storyRatings.js";
import type * as submitForms from "../submitForms.js";
import type * as tags from "../tags.js";
import type * as testDailyEmail from "../testDailyEmail.js";
import type * as testEmailFreshness from "../testEmailFreshness.js";
import type * as testUserReportEmail from "../testUserReportEmail.js";
import type * as testWelcomeEmail from "../testWelcomeEmail.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as validators from "../validators.js";
import type * as videoTranscripts from "../videoTranscripts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLog: typeof activityLog;
  "admin/adminActions": typeof admin_adminActions;
  "admin/forceLogout": typeof admin_forceLogout;
  adminAccess: typeof adminAccess;
  adminFollowsQueries: typeof adminFollowsQueries;
  adminJudgeTracking: typeof adminJudgeTracking;
  adminQueries: typeof adminQueries;
  agentJudges: typeof agentJudges;
  "agentReady/analytics": typeof agentReady_analytics;
  "agentReady/content": typeof agentReady_content;
  aiJudge: typeof aiJudge;
  aiJudgeAnalysis: typeof aiJudgeAnalysis;
  alerts: typeof alerts;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  clerk: typeof clerk;
  comments: typeof comments;
  convexBoxConfig: typeof convexBoxConfig;
  crons: typeof crons;
  dm: typeof dm;
  dmReactions: typeof dmReactions;
  emailSettings: typeof emailSettings;
  emailTemplates: typeof emailTemplates;
  "emails/broadcast": typeof emails_broadcast;
  "emails/daily": typeof emails_daily;
  "emails/emailTypes": typeof emails_emailTypes;
  "emails/helpers": typeof emails_helpers;
  "emails/judgingGroupEmails": typeof emails_judgingGroupEmails;
  "emails/linkHelpers": typeof emails_linkHelpers;
  "emails/mentions": typeof emails_mentions;
  "emails/queries": typeof emails_queries;
  "emails/render": typeof emails_render;
  "emails/reports": typeof emails_reports;
  "emails/resend": typeof emails_resend;
  "emails/spam": typeof emails_spam;
  "emails/submissions": typeof emails_submissions;
  "emails/templates": typeof emails_templates;
  "emails/unsubscribe": typeof emails_unsubscribe;
  "emails/weekly": typeof emails_weekly;
  "emails/welcome": typeof emails_welcome;
  follows: typeof follows;
  forms: typeof forms;
  hackathon: typeof hackathon;
  hackathonLog: typeof hackathonLog;
  http: typeof http;
  judgeScores: typeof judgeScores;
  judges: typeof judges;
  judgingCriteria: typeof judgingCriteria;
  judgingGroupSubmissions: typeof judgingGroupSubmissions;
  judgingGroups: typeof judgingGroups;
  mentions: typeof mentions;
  migrations: typeof migrations;
  reports: typeof reports;
  sendEmails: typeof sendEmails;
  settings: typeof settings;
  siteDirectory: typeof siteDirectory;
  siteFiles: typeof siteFiles;
  spamCheck: typeof spamCheck;
  spamCheckAnalysis: typeof spamCheckAnalysis;
  stories: typeof stories;
  storyFormFields: typeof storyFormFields;
  storyRatings: typeof storyRatings;
  submitForms: typeof submitForms;
  tags: typeof tags;
  testDailyEmail: typeof testDailyEmail;
  testEmailFreshness: typeof testEmailFreshness;
  testUserReportEmail: typeof testUserReportEmail;
  testWelcomeEmail: typeof testWelcomeEmail;
  users: typeof users;
  utils: typeof utils;
  validators: typeof validators;
  videoTranscripts: typeof videoTranscripts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
  workpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"workpool">;
  spamWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"spamWorkpool">;
  agentReady: import("@waynesutton/agent-ready/_generated/component.js").ComponentApi<"agentReady">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  contextDev: import("@context-dot-dev/convex/_generated/component.js").ComponentApi<"contextDev">;
};
