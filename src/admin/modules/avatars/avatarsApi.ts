// The avatars table and bucket for the admin (migration 089). Super admins
// read every row (deleted ones too) and write them directly under RLS;
// usage, reorder and purge are RPCs. Every call throws on failure.
import { supabase } from '../../../lib/supabase';
import { AVATAR_BUCKET, avatarFileUrl } from '../../../components/stage/avatars';
import { avatarObjectNames } from './avatarImage';

export type AvatarStatus = 'published' | 'unpublished';

export interface AdminAvatar {
  id: string;
  title_en: string;
  title_el: string;
  thumb_path: string;
  full_path: string;
  status: AvatarStatus;
  sort: number;
  created_at: string;
  deleted_at: string | null;
}

/** Days a deleted avatar that players use waits before it can be purged. */
export const PURGE_AFTER_DAYS = 30;

export const thumbUrl = (a: Pick<AdminAvatar, 'thumb_path'>) => avatarFileUrl(a.thumb_path, supabase);
export const fullUrl = (a: Pick<AdminAvatar, 'full_path'>) => avatarFileUrl(a.full_path, supabase);

export async function listAvatars(): Promise<AdminAvatar[]> {
  const { data, error } = await supabase
    .from('avatars')
    .select('id, title_en, title_el, thumb_path, full_path, status, sort, created_at, deleted_at')
    .order('sort', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminAvatar[];
}

/** avatar_id → players using it (in rooms that still exist). */
export async function avatarUsage(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('avatar_usage');
  if (error) throw error;
  return new Map(((data ?? []) as Array<{ avatar_id: string; players: number }>).map((r) => [r.avatar_id, r.players]));
}

export async function updateAvatars(ids: string[], patch: Partial<Pick<AdminAvatar, 'title_en' | 'title_el' | 'status' | 'deleted_at'>>): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('avatars').update(patch).in('id', ids);
  if (error) throw error;
}

export async function reorderAvatars(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('avatars_reorder', { p_ids: ids });
  if (error) throw error;
}

/** Uploads the two files and inserts the row. On a failed insert the files are removed again. */
export async function addAvatar(a: { id: string; title_en: string; title_el: string; status: AvatarStatus; sort: number; thumb: Blob; full: Blob }): Promise<AdminAvatar> {
  const names = avatarObjectNames(a.id);
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  for (const [name, blob] of [[names.thumb, a.thumb], [names.full, a.full]] as const) {
    const { error } = await bucket.upload(name, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (error) throw error;
  }
  const row = { id: a.id, title_en: a.title_en, title_el: a.title_el, thumb_path: names.thumb, full_path: names.full, status: a.status, sort: a.sort };
  const { error } = await supabase.from('avatars').insert(row);
  if (error) {
    // Best effort: the insert error is the one to show.
    await removeObjects([names.thumb, names.full]).catch(() => {});
    throw error;
  }
  return { ...row, created_at: new Date().toISOString(), deleted_at: null };
}

/** Removes a deleted avatar for good (and its uploaded files). Refused while players use it, for 30 days. */
export async function purgeAvatar(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('avatar_purge', { p_id: id });
  if (error) throw error;
  const objects = (data ?? []) as string[];
  if (objects.length) await removeObjects(objects);
}

/**
 * Removes bucket objects and checks that Storage really removed each one:
 * remove() answers without an error when RLS hides the rows, so a missing
 * name means the file is still public.
 */
async function removeObjects(names: string[]): Promise<void> {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).remove(names);
  if (error) throw error;
  const removed = new Set((data ?? []).map((o: { name: string }) => o.name));
  const left = names.filter((n) => !removed.has(n));
  if (left.length) throw new Error(`Τα αρχεία δεν σβήστηκαν από το Storage: ${left.join(', ')}`);
}

/** Whether a deleted avatar can be purged now. */
export function canPurge(a: Pick<AdminAvatar, 'deleted_at'>, usage: number, now: number = Date.now()): boolean {
  if (!a.deleted_at) return false;
  return usage === 0 || now - Date.parse(a.deleted_at) >= PURGE_AFTER_DAYS * 86_400_000;
}
