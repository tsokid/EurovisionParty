// Display helpers shared by the media picker and the media field.
import type { MediaKind } from '../../../../../supabase/functions/_shared/cms/fields';
import { t } from '../../../i18n';

export const KIND_LABEL: Record<MediaKind, string> = { image: t.media2.kind.image, video: t.media2.kind.video, captions: t.media2.kind.captions };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
