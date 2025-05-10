import { Doc, Id } from "../convex/_generated/dataModel";

// Represents a full Story document fetched from Convex,
// potentially including resolved tags and screenshot URL.
export type Story = Doc<"stories"> & {
  // Resolved data often added in queries:
  tags: Tag[];
  screenshotUrl: string | null;
  userId?: Id<"users">;
  authorName?: string;
  authorUsername?: string;
  // Calculated fields if needed:
  // voteScore?: number;
  // averageRating?: number;
};

// Represents a full Comment document fetched from Convex.
export type Comment = Doc<"comments"> & {
  // Existing fields are from Doc<"comments">
  // Add new fields that come from the backend query (listApprovedByStory)
  authorName?: string;
  authorUsername?: string;
  // replies?: Comment[]; // If you implement nested replies display directly in type
};

// Represents a full Tag document fetched from Convex.
export type Tag = Doc<"tags">;

// Represents the Settings document (singleton)
export type SiteSettings = Doc<"settings">;

// Represents a Custom Form document
export type CustomForm = Doc<"forms">;

// Represents a Form Field document
export type FormField = Doc<"formFields">;

// Represents a Form Submission document
export type FormSubmission = Doc<"formSubmissions">;

// ------ Placeholder/Legacy Types (Review if still needed) ------

// Kept for reference, but prefer using Doc<"users"> if defined
export interface User {
  id: string; // Should this be Id<"users">?
  username: string;
  email: string;
  role: "user" | "admin";
  karma: number;
  createdAt: number; // Convex uses number for _creationTime
}

// This seems redundant now with Doc<"tags">, keeping for reference.
// export interface Tag {
//   name: string;
//   showInHeader: boolean;
// }

// Use FormField["fieldType"] instead
// export type FormFieldType =
//   | "shortText"
//   | "longText"
//   | "url"
//   | "email"
//   | "yesNo"
//   | "dropdown"
//   | "multiSelect";

// This structure is represented by Doc<"formFields"> now
// export interface FormField {
//   id: string; // Should be _id: Id<"formFields">?
//   type: FormFieldType;
//   label: string;
//   required: boolean;
//   options?: string[];
//   placeholder?: string;
// }

// This structure is represented by Doc<"forms"> now
// export interface CustomForm {
//   id: string; // Should be _id: Id<"forms">?
//   title: string;
//   slug: string;
//   fields: FormField[]; // This would be fetched separately
//   isPublic: boolean;
//   createdAt: number; // Convex uses number for _creationTime
// }

// This structure is represented by Doc<"formSubmissions"> now
// export interface FormSubmission {
//   id: string; // Should be _id: Id<"formSubmissions">?
//   formId: Id<"forms">;
//   data: Record<string, any>;
//   createdAt: number; // Convex uses number for _creationTime
// }
