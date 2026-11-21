export type UserRole = 'student' | 'lecturer' | 'admin';

export type ResourceType = 'book' | 'article' | 'video' | 'recording';

export type ResourceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type SourceType = 'publisher' | 'open-access' | 'licensed' | 'reel' | 'depot';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  group_name: string | null;
  skill_gaps: string[];
}

export interface Resource {
  id: number;
  title: string;
  description: string;
  url: string;
  source_type: SourceType;
  resource_type: ResourceType;
  course: string;
  topic: string;
  level: ResourceLevel;
  tags: string[];
  author: string;
  preview_image: string | null;
  preview_domain: string | null;
  duration_or_pages: string | null;
  is_physical: boolean;
  depot_shelf: string | null;
  total_copies: number;
  available_copies: number;
  borrowed_by: number | null;
  borrowed_by_name: string | null;
  due_date: string | null;
  reel_recording_id: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface ResourceFacets {
  courses: string[];
  topics: string[];
  levels: ResourceLevel[];
  types: ResourceType[];
  tags: string[];
}

export interface Collection {
  id: number;
  title: string;
  description: string;
  group_name: string;
  course: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  items: Resource[];
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string | null;
  domain: string;
  source_hint: SourceType;
}

export interface SkillRecommendation {
  gap: string;
  reason: string;
  resource: Resource;
}

export interface SkillMapResponse {
  user: User;
  skill_gaps: string[];
  recommendations: SkillRecommendation[];
}
