import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Flag } from './Flag';

export interface EntriesProps {
  /** From 1024px, open each row into columns (country · artist · song · points). */
  wide?: boolean;
  /** Use `<ol>` (ranked results, running order) or `<ul>`. */
  ordered?: boolean;
  className?: string;
  'aria-label'?: string;
  children?: ReactNode;
}

/** `.entries` list container. Children: `<EntryRow>`. */
export function Entries({ wide = false, ordered = true, className, children, ...rest }: EntriesProps) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={clsx('entries', wide && 'wide', className)} {...rest}>{children}</Tag>;
}

export interface EntryRowProps {
  position: number | string;
  iso: string | null | undefined;
  country: string;
  artist?: string | null;
  song?: string | null;
  points?: number | string | null;
  /** The player's own row / pick. */
  highlight?: boolean;
  /** Gold / silver / bronze position colour for 1–3 (ranked results only). */
  podium?: boolean;
  className?: string;
}

/**
 * One row of `.entries`: position, flag, country, "artist · song", points.
 * 390px: 4 columns, long names end in an ellipsis. ≥1024px in `wide`
 * lists: the same markup becomes 6 columns (`.who`/`.song` display: contents).
 */
export function EntryRow({ position, iso, country, artist, song, points, highlight = false, podium = false, className }: EntryRowProps) {
  const pos = typeof position === 'number' ? position : Number.parseInt(position, 10);
  const medal = podium && pos >= 1 && pos <= 3 ? `p${pos}` : null;
  const hasArtist = !!artist;
  const hasSong = !!song;
  const line = [artist, song].filter(Boolean).join(' · ');
  return (
    <li className={clsx('entry', medal, highlight && 'hl', className)} aria-current={highlight || undefined}>
      <span className="pos">{position}</span>
      <Flag iso={iso} />
      <div className="who">
        <div className="country" title={country}>{country}</div>
        {(hasArtist || hasSong) && (
          <div className="song" title={line}>
            {hasArtist && <span className="artist">{artist}</span>}
            {hasArtist && hasSong && <span className="sep"> · </span>}
            {hasSong && <span className="title">{song}</span>}
          </div>
        )}
      </div>
      {points !== undefined && points !== null && <span className="pts">{points}</span>}
    </li>
  );
}
