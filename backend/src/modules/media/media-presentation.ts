export const MEDIA_PRESENTATIONS = ["cover", "contain"] as const;

export type MediaPresentation = (typeof MEDIA_PRESENTATIONS)[number];
