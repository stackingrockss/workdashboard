export type ContentType =
  | "blog_post"
  | "case_study"
  | "whitepaper"
  | "video"
  | "webinar"
  | "other";

export interface Content {
  id: string;
  title: string;
  url: string;
  description: string | null;
  contentType: ContentType;
  createdById: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog_post: "Blog Post",
  case_study: "Case Study",
  whitepaper: "Whitepaper",
  video: "Video",
  webinar: "Webinar",
  other: "Other",
};
