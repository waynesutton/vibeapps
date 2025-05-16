/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as adminQueries from "../adminQueries.js";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as clerk from "../clerk.js";
import type * as comments from "../comments.js";
import type * as convexBoxConfig from "../convexBoxConfig.js";
import type * as forms from "../forms.js";
import type * as http from "../http.js";
import type * as reports from "../reports.js";
import type * as settings from "../settings.js";
import type * as stories from "../stories.js";
import type * as storyRatings from "../storyRatings.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as validators from "../validators.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  adminQueries: typeof adminQueries;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  clerk: typeof clerk;
  comments: typeof comments;
  convexBoxConfig: typeof convexBoxConfig;
  forms: typeof forms;
  http: typeof http;
  reports: typeof reports;
  settings: typeof settings;
  stories: typeof stories;
  storyRatings: typeof storyRatings;
  tags: typeof tags;
  users: typeof users;
  utils: typeof utils;
  validators: typeof validators;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
