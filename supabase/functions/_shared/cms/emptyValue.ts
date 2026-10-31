// The empty value of a CMS field: what the admin inserts for a new list item
// or an optional field that is switched on. Pure; built with walkSchema.
//
//   text/multiline/richText/href  ''
//   flag                          false
//   choice                        its first option
//   list                          []
//   group                         { each non-optional key: its empty value }
//   tuple                         [ each position's empty value ]
//   optional                      absent (undefined; the key is left out)
//
// Every call returns a fresh value (no shared containers).
import type { z } from 'zod';
import { walkSchema, type Segment } from './walk.ts';

export function emptyValue(schema: z.ZodType): unknown {
  let root: unknown;
  const put = (segments: Segment[], value: unknown) => {
    if (!segments.length) {
      root = value;
      return;
    }
    let node = root as Record<string | number, unknown>;
    for (const seg of segments.slice(0, -1)) node = node[seg] as Record<string | number, unknown>;
    node[segments[segments.length - 1]] = value;
  };
  walkSchema(schema, (n) => {
    const m = n.meta;
    if (m.optional) return false;
    switch (m.kind) {
      case 'group':
        put(n.segments, {});
        return true;
      case 'tuple':
        put(n.segments, []);
        return true;
      case 'list':
        put(n.segments, []);
        return false;
      case 'choice':
        put(n.segments, m.options?.[0] ?? '');
        return false;
      case 'flag':
        put(n.segments, false);
        return false;
      default:
        put(n.segments, '');
        return false;
    }
  });
  return root;
}
