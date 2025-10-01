/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_adminActions from "../admin/adminActions.js";
import type * as admin_forceLogout from "../admin/forceLogout.js";
import type * as adminFollowsQueries from "../adminFollowsQueries.js";
import type * as adminJudgeTracking from "../adminJudgeTracking.js";
import type * as adminQueries from "../adminQueries.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as clerk from "../clerk.js";
import type * as comments from "../comments.js";
import type * as convexBoxConfig from "../convexBoxConfig.js";
import type * as crons from "../crons.js";
import type * as dm from "../dm.js";
import type * as emailSettings from "../emailSettings.js";
import type * as emails_broadcast from "../emails/broadcast.js";
import type * as emails_daily from "../emails/daily.js";
import type * as emails_helpers from "../emails/helpers.js";
import type * as emails_linkHelpers from "../emails/linkHelpers.js";
import type * as emails_mentions from "../emails/mentions.js";
import type * as emails_queries from "../emails/queries.js";
import type * as emails_reports from "../emails/reports.js";
import type * as emails_resend from "../emails/resend.js";
import type * as emails_templates from "../emails/templates.js";
import type * as emails_unsubscribe from "../emails/unsubscribe.js";
import type * as emails_weekly from "../emails/weekly.js";
import type * as emails_welcome from "../emails/welcome.js";
import type * as follows from "../follows.js";
import type * as forms from "../forms.js";
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
import type * as siteFiles from "../siteFiles.js";
import type * as stories from "../stories.js";
import type * as storyFormFields from "../storyFormFields.js";
import type * as storyRatings from "../storyRatings.js";
import type * as submitForms from "../submitForms.js";
import type * as tags from "../tags.js";
import type * as testDailyEmail from "../testDailyEmail.js";
import type * as testUserReportEmail from "../testUserReportEmail.js";
import type * as testWelcomeEmail from "../testWelcomeEmail.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "admin/adminActions": typeof admin_adminActions;
  "admin/forceLogout": typeof admin_forceLogout;
  adminFollowsQueries: typeof adminFollowsQueries;
  adminJudgeTracking: typeof adminJudgeTracking;
  adminQueries: typeof adminQueries;
  alerts: typeof alerts;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  clerk: typeof clerk;
  comments: typeof comments;
  convexBoxConfig: typeof convexBoxConfig;
  crons: typeof crons;
  dm: typeof dm;
  emailSettings: typeof emailSettings;
  "emails/broadcast": typeof emails_broadcast;
  "emails/daily": typeof emails_daily;
  "emails/helpers": typeof emails_helpers;
  "emails/linkHelpers": typeof emails_linkHelpers;
  "emails/mentions": typeof emails_mentions;
  "emails/queries": typeof emails_queries;
  "emails/reports": typeof emails_reports;
  "emails/resend": typeof emails_resend;
  "emails/templates": typeof emails_templates;
  "emails/unsubscribe": typeof emails_unsubscribe;
  "emails/weekly": typeof emails_weekly;
  "emails/welcome": typeof emails_welcome;
  follows: typeof follows;
  forms: typeof forms;
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
  siteFiles: typeof siteFiles;
  stories: typeof stories;
  storyFormFields: typeof storyFormFields;
  storyRatings: typeof storyRatings;
  submitForms: typeof submitForms;
  tags: typeof tags;
  testDailyEmail: typeof testDailyEmail;
  testUserReportEmail: typeof testUserReportEmail;
  testWelcomeEmail: typeof testWelcomeEmail;
  users: typeof users;
  utils: typeof utils;
  validators: typeof validators;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          createdAt: number;
          errorMessage?: string;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject: string;
          text?: string;
          to: string;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          errorMessage: string | null;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject: string;
          text?: string;
          to: string;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
};
