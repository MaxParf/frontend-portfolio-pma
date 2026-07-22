export type Locale = "en" | "ru";

export interface AdminUser {
  id: string;
  login: string;
  displayName: string;
  role: "owner";
}

export interface AdminProject {
  id: string;
  databaseId: string;
  slug: string;
  galleryId: string;
  status: string;
  sortOrder: number;
  type: string | null;
  startedAt: string | null;
  endedAt: string | null;
  isOngoing: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  links: {
    primary: { href: string; type: string | null } | null;
    secondary: { href: string; type: string | null } | null;
  };
  translations: Record<
    Locale,
    {
      title: string;
      subtitle: string | null;
      description: string;
      role: string;
      statusLabel: string;
      primaryActionLabel: string | null;
      secondaryActionLabel: string | null;
      technologiesTitle: string | null;
    }
  >;
  technologies: string[];
  media: Array<{
    id: string;
    src: string;
    role: string;
    sortOrder: number;
    translations: Record<Locale, { alt: string; ariaLabel: string }>;
  }>;
}
