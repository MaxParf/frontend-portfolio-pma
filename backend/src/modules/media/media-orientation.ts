export const MEDIA_ORIENTATIONS = ["vertical", "horizontal"] as const;

export type MediaOrientation = (typeof MEDIA_ORIENTATIONS)[number];

/** Presentation metadata of a media reference in one project, never of the physical asset. */
export function mediaOrientationFromDimensions(width: number, height: number): MediaOrientation | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return height > width ? "vertical" : "horizontal";
}
