import type {
  Collection,
  LinkPreview,
  Resource,
  ResourceFacets,
  SkillMapResponse,
  User,
} from './types.ts';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function request<T>(
  url: string,
  userId: number,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': String(userId),
      ...(options.headers ?? {}),
    },
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    if (options.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw err;
    }
    data = {};
  }

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getUsers: () => request<{ users: User[] }>('/api/users', 1),

  getResources: (
    userId: number,
    params: {
      q?: string;
      course?: string;
      topic?: string;
      level?: string;
      type?: string;
      tag?: string;
      physicalOnly?: boolean;
      availableOnly?: boolean;
    } = {},
    signal?: AbortSignal
  ) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.course) qs.set('course', params.course);
    if (params.topic) qs.set('topic', params.topic);
    if (params.level) qs.set('level', params.level);
    if (params.type) qs.set('type', params.type);
    if (params.tag) qs.set('tag', params.tag);
    if (params.physicalOnly) qs.set('physicalOnly', 'true');
    if (params.availableOnly) qs.set('availableOnly', 'true');
    const query = qs.toString();
    return request<{
      resources: Resource[];
      total: number;
      facets: ResourceFacets;
      searchMode: 'fts5' | 'browse';
    }>(`/api/resources${query ? `?${query}` : ''}`, userId, { signal });
  },

  createResource: (userId: number, payload: Record<string, unknown>) =>
    request<Resource>('/api/resources', userId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateResource: (userId: number, id: number, payload: Record<string, unknown>) =>
    request<Resource>(`/api/resources/${id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteResource: (userId: number, id: number) =>
    request<{ deleted: boolean; id: number }>(`/api/resources/${id}`, userId, {
      method: 'DELETE',
    }),

  fetchLinkPreview: (userId: number, url: string) =>
    request<LinkPreview>('/api/link-preview', userId, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  getCollections: (userId: number) =>
    request<{ collections: Collection[] }>('/api/collections', userId),

  createCollection: (
    userId: number,
    payload: { title: string; description: string; group_name: string; course: string }
  ) =>
    request<Collection>('/api/collections', userId, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addResourceToCollection: (userId: number, collectionId: number, resourceId: number) =>
    request<Collection>(`/api/collections/${collectionId}/items`, userId, {
      method: 'POST',
      body: JSON.stringify({ resource_id: resourceId }),
    }),

  removeResourceFromCollection: (userId: number, collectionId: number, resourceId: number) =>
    request<Collection>(`/api/collections/${collectionId}/items/${resourceId}`, userId, {
      method: 'DELETE',
    }),

  deleteCollection: (userId: number, collectionId: number) =>
    request<{ deleted: boolean }>(`/api/collections/${collectionId}`, userId, {
      method: 'DELETE',
    }),

  syncReel: (userId: number) =>
    request<{ importedCount: number; imported: Resource[]; message: string }>(
      '/api/integrations/reel/sync',
      userId,
      { method: 'POST' }
    ),

  getSkillMap: (userId: number) =>
    request<SkillMapResponse>('/api/integrations/skill-map', userId),

  borrowBook: (userId: number, resourceId: number) =>
    request<Resource>(`/api/integrations/depot/${resourceId}/borrow`, userId, {
      method: 'POST',
    }),

  returnBook: (userId: number, resourceId: number) =>
    request<Resource>(`/api/integrations/depot/${resourceId}/return`, userId, {
      method: 'POST',
    }),
};
