import type { ImgHTMLAttributes, SyntheticEvent } from "react";

// Only prod storage is wired to the Netlify Image CDN (see public/_redirects).
const PROD_STORAGE_PREFIX =
  "https://whimsical-dalmatian-205.convex.cloud/api/storage/";
const STORAGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Must match the /_img/{width}/:id rules in public/_redirects
export const THUMBNAIL_WIDTHS = [160, 320, 400, 720, 1080] as const;
export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

export type ThumbnailSizing = {
  widths: readonly ThumbnailWidth[];
  sizes: string;
};

// List row: 80px mobile, 136px desktop
export const LIST_THUMB: ThumbnailSizing = {
  widths: [160, 320],
  sizes: "(min-width: 640px) 136px, 80px",
};

// Vibe row: full width on mobile, 195px column on desktop
export const VIBE_THUMB: ThumbnailSizing = {
  widths: [400, 720, 1080],
  sizes: "(min-width: 768px) 195px, 100vw",
};

// Grid card: 1, 2, then 3 columns beside the sidebar
export const GRID_THUMB: ThumbnailSizing = {
  widths: [400, 720, 1080],
  sizes: "(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw",
};

type ThumbnailProps = Pick<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "sizes" | "onError"
>;

// Returns resized src/srcSet for prod storage URLs; anything else passes through.
// On a CDN error the image swaps back to the original URL once.
export function thumbnailImageProps(
  url: string,
  sizing: ThumbnailSizing,
): ThumbnailProps {
  if (!import.meta.env.PROD || !url.startsWith(PROD_STORAGE_PREFIX)) {
    return { src: url };
  }
  const id = url.slice(PROD_STORAGE_PREFIX.length);
  if (!STORAGE_ID.test(id)) return { src: url };

  const { widths, sizes } = sizing;
  return {
    src: `/_img/${widths[0]}/${id}`,
    srcSet: widths.map((w) => `/_img/${w}/${id} ${w}w`).join(", "),
    sizes,
    onError: (event: SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      if (img.dataset.thumbFallback) return;
      img.dataset.thumbFallback = "1";
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = url;
    },
  };
}
