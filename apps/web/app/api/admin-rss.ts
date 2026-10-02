import axios from '@/app/api/axios';

export type RssInputV1 = {
  name: string; url: string; accountPublicId: string; intervalMinutes: number; enabled: boolean;
};
export type RssSourceV1 = RssInputV1 & {
  id: string; createdAtMs: number; updatedAtMs: number; nextRunAtMs: number | null;
  lastCheckedAtMs: number | null; lastPublishedAtMs: number | null;
  lastPostId: string | null; lastError: string | null; publishedCount: number;
};
export async function getRssSources(): Promise<RssSourceV1[]> {
  return (await axios.get<{ version: 1; sources: RssSourceV1[] }>('/admin/rss')).data.sources;
}
export async function saveRssSource(input: RssInputV1, id?: string): Promise<void> {
  if (id) await axios.put(`/admin/rss/${id}`, input);
  else await axios.post('/admin/rss', input);
}
export async function deleteRssSource(id: string): Promise<void> { await axios.delete(`/admin/rss/${id}`); }
