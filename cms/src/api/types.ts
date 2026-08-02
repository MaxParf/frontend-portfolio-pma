export {
  type Locale,
  type ProjectDraftContent as DraftContent,
  type AdminProjectListItem as AdminProject,
  type AdminProjectRevisionDto as ProjectRevision,
  type AdminProjectEditorResponse as ProjectEditor,
  type ProjectStatus as AdminProjectStatus,
} from "../../../contracts/project-contracts";

export type MediaOrientation = "vertical" | "horizontal";
export type MediaPresentation = "cover" | "contain";
export type ProjectGalleryKind = "mobile" | "desktop";
export type MediaTranslations = Record<"en" | "ru", { alt: string; ariaLabel: string }>;
export type LegacyMedia = Extract<import("../../../contracts/project-contracts").ProjectDraftContent["media"][number], { sourceType: "legacy" }>;
export type ManagedMedia = Extract<import("../../../contracts/project-contracts").ProjectDraftContent["media"][number], { sourceType: "managed" }>;

export interface AdminUser { id: string; login: string; displayName: string; role: "owner"; }
export interface UploadedMedia { assetId: string; sourceType: "managed"; role: "gallery"; orientation: MediaOrientation; previewUrl: string; thumbnailUrl: string; width: number; height: number; }
