// The errors (red) and warnings (amber) of one field, or of one locale of it.
import type { Issue } from '../formModel';

type Props = {
  id?: string;
  issues: readonly Issue[];
  /** Prefix each message with its locale ("EL: …"), for a control or container that covers both. */
  withLocale?: boolean;
};

export function IssueList({ id, issues, withLocale }: Props) {
  if (!issues.length) return null;
  return (
    <ul id={id} className="space-y-0.5">
      {issues.map((i, n) => (
        <li key={n} className={`text-xs ${i.level === 'error' ? 'text-red-300' : 'text-amber-300'}`}>
          {withLocale && i.locale ? `${i.locale.toUpperCase()}: ` : ''}
          {i.message}
        </li>
      ))}
    </ul>
  );
}
