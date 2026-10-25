import { safeHref } from "./safeHref";

// Where a judging view should link a submission. Public stories open their
// /s/slug page; judging only imports have no public page, so they open the
// import source (Devpost) or the project URL instead.
export type SubmissionLinkInput = {
  slug: string;
  judgingOnly?: boolean;
  importSourceUrl?: string;
  url?: string;
};

export type SubmissionLink = {
  href: string;
  // True when href points off site (open in a new tab, plain <a>)
  external: boolean;
  isPublic: boolean;
};

export function submissionLink(input: SubmissionLinkInput): SubmissionLink {
  if (!input.judgingOnly) {
    return { href: `/s/${input.slug}`, external: false, isPublic: true };
  }
  const href = safeHref(input.importSourceUrl ?? input.url) ?? "";
  return { href, external: true, isPublic: false };
}

export const NOT_PUBLIC_TITLE =
  "Judging only: imported for this group and hidden from the public site";
