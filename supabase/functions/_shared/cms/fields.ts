// CMS field constructors (spec §3 "Schemas", "Field kinds").
//
// Each constructor returns a plain zod schema and records its metadata in a
// zod registry, which the admin form generator reads back with fieldMeta().
// String fields carry their own checks (required in this locale, maxLength,
// allowed placeholders, the rawHtml allowlist, safe hrefs), so validating a
// locale is a single safeParse. Objects are strict: unknown keys are errors.
// Soft limits (softMaxLength) are not checked here: validateDocument reports
// them as warnings.
//
// Runtime zod is for scripts, tests and the admin route only. Site components
// take types from schemas with `import type` + z.infer, never a value import,
// so zod stays out of the client bundle (tests/scripts/bundleSize.test.ts).
//
// Deno-free. Bare "zod" specifier: Node/Vite resolve it from node_modules; an
// edge function that imports this needs "zod": "npm:zod@4.3.6" in its
// deno.json import map.
import { z } from 'zod';
import { placeholdersIn } from './placeholders.ts';
import { htmlErrors, isSafeHref } from './html.ts';
import { richTextErrors } from './richText.ts';

export { blockVariants, fieldAt, fieldPaths } from './walk.ts';

export type FieldKind =
  | 'text' | 'multiline' | 'richText' | 'href' | 'mediaRef'
  | 'list' | 'group' | 'tuple' | 'choice' | 'flag'
  // image() and video() are groups (zod objects) that the admin draws as media pickers.
  | 'image' | 'video'
  // blocks() is a list whose items are a union of groups told apart by `discriminator`.
  | 'blocks' | 'union';

/** What a mediaRef() points at; its published extension is webp, mp4 or vtt. */
export type MediaKind = 'image' | 'video' | 'captions';

type StringKind = 'text' | 'multiline' | 'richText' | 'href' | 'mediaRef';

export type FieldMeta = {
  kind: FieldKind;
  label?: string;
  help?: string;
  /** String kinds only: hard limit (a validation error). */
  maxLength?: number;
  /** String kinds only: recommended limit (a validation warning, an editor counter). */
  softMaxLength?: number;
  /** String kinds only: placeholder names this field may use (without braces). */
  placeholders?: string[];
  /** String kinds with placeholders only: what each placeholder is filled with, by name. */
  placeholderHelp?: Record<string, string>;
  /** String kinds only: must be non-empty (after trim) in every locale. Default true. */
  required?: boolean;
  /** choice only: the allowed values, in display order. */
  options?: string[];
  /**
   * Locale-shared: not translated, so `el` must equal `en` at the same path
   * (validateDocument enforces it). Default true for choice, flag and href,
   * false otherwise. The admin edits it once for both locales.
   */
  shared?: boolean;
  /**
   * String kinds only: rendered as raw HTML (dangerouslySetInnerHTML), so it
   * may contain tags, within the allowlist of html.ts.
   */
  rawHtml?: boolean;
  /** group only: keys that go together; in each pair both are set or neither is. */
  pairs?: [string, string][];
  /** mediaRef only: the kind of upload it accepts. */
  mediaKind?: MediaKind;
  /** blocks and union only: the key that tells the variants apart (its value is the variant name). */
  discriminator?: string;
  /** blocks and union only: the variant names, in display order (blockVariants() gives their schemas). */
  variants?: string[];
  /** Set by optional(): the key may be absent. The rest of the metadata is the inner field's. */
  optional?: boolean;
  /**
   * String kinds only: the page's <title> or meta description (seoTitle() /
   * metaDescription()). Unique per locale across the site pages (seo.ts).
   */
  seo?: 'title' | 'description';
};

export type StringFieldOptions = {
  label?: string;
  help?: string;
  maxLength?: number;
  softMaxLength?: number;
  placeholders?: string[];
  /** Overrides the default help line of a placeholder (see DEFAULT_PLACEHOLDER_HELP). */
  placeholderHelp?: Record<string, string>;
  required?: boolean;
  shared?: boolean;
  rawHtml?: boolean;
  /** See FieldMeta.seo; false opts a seoTitle()/metaDescription() look-alike (a JSON-LD copy) out. */
  seo?: 'title' | 'description' | false;
};

export type ContainerFieldOptions = { label?: string; help?: string; shared?: boolean };

export type GroupFieldOptions = ContainerFieldOptions & { pairs?: [string, string][] };

/**
 * What each live-contest placeholder is filled with (the page fills them from
 * contestTexts()). A field using any other placeholder states its own help.
 */
export const DEFAULT_PLACEHOLDER_HELP: Record<string, string> = {
  year: 'The live contest year, e.g. 2026',
  city: 'The host city, e.g. Vienna (Βιέννη in Greek)',
  cityIn: 'The host city with "in", e.g. "in Vienna" ("στη Βιέννη" in Greek)',
  cityFrom: 'The host city with "from", e.g. "from Vienna" ("από τη Βιέννη" in Greek)',
  finalDay: 'The date of the grand final, e.g. "Saturday 16 May 2026"',
  finalDayShort: 'The date of the grand final without the year, e.g. "Saturday 16 May"',
  hostName: 'The host country, e.g. Austria',
  count: 'A number the page fills in, e.g. how many countries take part',
};

const cmsFields = z.registry<FieldMeta>();

function placeholderHelpFor(placeholders: string[], overrides: Record<string, string> = {}): Record<string, string> {
  for (const name of Object.keys(overrides)) {
    if (!placeholders.includes(name)) throw new Error(`placeholderHelp: {${name}} is not one of the field's placeholders`);
  }
  return Object.fromEntries(placeholders.map((name) => {
    const help = overrides[name] ?? DEFAULT_PLACEHOLDER_HELP[name];
    if (!help) throw new Error(`placeholderHelp: placeholder {${name}} needs a help line (no default for it)`);
    return [name, help];
  }));
}

/** Hard length limit of a richText() field (the parser itself accepts any length). */
export const RICH_TEXT_MAX = 20_000;

const MEDIA_EXT: Record<MediaKind, string> = { image: 'webp', video: 'mp4', captions: 'vtt' };

/**
 * A reference to an upload: `cms-media/<uuid>` in a draft (the cms_media row
 * id), `/media/<sha12>.<ext>` once published. Always lowercase. The extension
 * must be the one of `kind`.
 */
export const mediaRefPattern = (kind: MediaKind) =>
  new RegExp(`^(cms-media/[0-9a-f-]{36}|/media/[0-9a-f]{12}\\.${MEDIA_EXT[kind]})$`);

function stringField(kind: StringKind, opts: StringFieldOptions = {}, mediaKind?: MediaKind) {
  const placeholders = [...(opts.placeholders ?? [])];
  const meta: FieldMeta = {
    kind,
    ...(opts.label !== undefined && { label: opts.label }),
    ...(opts.help !== undefined && { help: opts.help }),
    ...(opts.maxLength !== undefined && { maxLength: opts.maxLength }),
    ...(opts.softMaxLength !== undefined && { softMaxLength: opts.softMaxLength }),
    placeholders,
    ...(placeholders.length && { placeholderHelp: placeholderHelpFor(placeholders, opts.placeholderHelp) }),
    required: opts.required ?? true,
    // href and mediaRef are shared unless they opt out (and record the opt-out); other kinds opt in.
    ...(kind === 'href' || kind === 'mediaRef' ? { shared: opts.shared ?? true } : opts.shared && { shared: true }),
    ...(mediaKind && { mediaKind }),
    ...(opts.rawHtml && { rawHtml: true }),
    ...(opts.seo && { seo: opts.seo }),
  };
  if (!placeholders.length && opts.placeholderHelp) placeholderHelpFor(placeholders, opts.placeholderHelp);
  const allowed = new Set(placeholders);
  const schema = z.string().superRefine((value, ctx) => {
    if (meta.required && value.trim() === '') {
      ctx.addIssue({ code: 'custom', message: 'Required: must not be empty' });
    }
    if (meta.maxLength !== undefined && value.length > meta.maxLength) {
      ctx.addIssue({ code: 'custom', message: `Too long: ${value.length} characters, max ${meta.maxLength}` });
    }
    // A templated field renders through interpolate(), which unescapes {{ and }}.
    // A field without placeholders may be rendered raw, so escapes there are
    // almost certainly an extraction mistake.
    if (allowed.size === 0 && (value.includes('{{') || value.includes('}}'))) {
      ctx.addIssue({ code: 'custom', message: 'escaped braces in a field without placeholders' });
    }
    for (const name of placeholdersIn(value)) {
      if (!allowed.has(name)) {
        const list = placeholders.length ? placeholders.map((p) => `{${p}}`).join(', ') : 'none';
        ctx.addIssue({ code: 'custom', message: `Unknown placeholder {${name}} (allowed: ${list}; write {{ for a literal brace)` });
      }
    }
    if (meta.rawHtml) {
      for (const message of htmlErrors(value)) ctx.addIssue({ code: 'custom', message });
    }
    if (kind === 'href' && value !== '' && !isSafeHref(value)) {
      ctx.addIssue({ code: 'custom', message: 'Must start with / (a page on this site) or https://' });
    }
    if (kind === 'mediaRef' && value !== '' && !mediaRefPattern(mediaKind!).test(value)) {
      ctx.addIssue({ code: 'custom', message: `Not a valid ${mediaKind} reference: pick an uploaded file` });
    }
    if (kind === 'richText' && value.length > RICH_TEXT_MAX) {
      ctx.addIssue({ code: 'custom', message: `Too long: ${value.length} characters, max ${RICH_TEXT_MAX} for rich text` });
    } else if (kind === 'richText') {
      for (const e of richTextErrors(value)) ctx.addIssue({ code: 'custom', message: `Line ${e.line}: ${e.message}` });
    }
  });
  schema.register(cmsFields, meta);
  return schema;
}

/** Single-line string. */
export const text = (opts?: StringFieldOptions) => stringField('text', opts);

/** Multi-line plain string. */
export const multiline = (opts?: StringFieldOptions) => stringField('multiline', opts);

/**
 * Limited Markdown, stored as a string (syntax and errors: richText.ts;
 * rendered by src/components/cms/RichText.tsx).
 */
export const richText = (opts?: StringFieldOptions) => stringField('richText', opts);

/**
 * A link target: a path on this site (`/faq`) or an `https://` URL. Locale-
 * shared by default (the same in both languages); pass `shared: false` for a
 * link that differs per locale.
 */
export const href = (opts: Omit<StringFieldOptions, 'rawHtml'> = {}) =>
  stringField('href', { help: 'A page on this site, e.g. /faq, or an https:// address', ...opts });

/** Ordered list of `item`. */
export function list<T extends z.ZodType>(item: T, opts: ContainerFieldOptions = {}) {
  const schema = z.array(item);
  schema.register(cmsFields, { kind: 'list', ...opts });
  return schema;
}

/** A value counts as set when present and, for a string, not blank. */
const isSet = (v: unknown) => v !== undefined && !(typeof v === 'string' && v.trim() === '');

/**
 * Strict object of named fields. `pairs` links keys that only make sense
 * together (a link's label and its href): in each pair both are set or
 * neither is; the error is reported at the missing key.
 */
export function group<S extends Record<string, z.ZodType>>(shape: S, opts: GroupFieldOptions = {}) {
  return groupOfKind('group', shape, opts);
}

function groupOfKind<S extends Record<string, z.ZodType>>(kind: 'group' | 'image' | 'video', shape: S, opts: GroupFieldOptions = {}) {
  const pairs = opts.pairs?.map(([a, b]) => [a, b] as [string, string]);
  for (const key of pairs?.flat() ?? []) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) throw new Error(`group: pair key "${key}" is not a field of the group`);
  }
  let schema = z.strictObject(shape);
  if (pairs?.length) {
    schema = schema.superRefine((value, ctx) => {
      const v = value as Record<string, unknown>;
      for (const [a, b] of pairs) {
        if (isSet(v[a]) === isSet(v[b])) continue;
        ctx.addIssue({ code: 'custom', path: [isSet(v[a]) ? b : a], message: `Set both ${a} and ${b}, or neither` });
      }
    });
  }
  schema.register(cmsFields, {
    kind,
    ...(opts.label !== undefined && { label: opts.label }),
    ...(opts.help !== undefined && { help: opts.help }),
    ...(opts.shared !== undefined && { shared: opts.shared }),
    ...(pairs?.length && { pairs }),
  });
  return schema;
}

/** Fixed-length list with one schema per position (e.g. a table's column headers). */
export function tuple<const T extends readonly [z.ZodType, ...z.ZodType[]]>(items: T, opts: ContainerFieldOptions = {}) {
  const schema = z.tuple(items);
  schema.register(cmsFields, { kind: 'tuple', ...opts });
  return schema;
}

/**
 * One of a fixed set of string values (a presentation switch such as a table
 * cell's tone, or a stable anchor id). Not translated text: editors pick a value.
 */
export function choice<const V extends readonly [string, ...string[]]>(values: V, opts: ContainerFieldOptions = {}) {
  const schema = z.enum(values);
  schema.register(cmsFields, { kind: 'choice', ...opts, options: [...values], shared: opts.shared ?? true });
  return schema;
}

/**
 * A reference to an uploaded file of `kind`, picked in the media library.
 * Locale-shared by default (one file for both languages).
 */
export const mediaRef = (kind: MediaKind, opts: Pick<StringFieldOptions, 'label' | 'help' | 'shared'> = {}) =>
  stringField('mediaRef', opts, kind);

/** An image with its alt text: the file is shared by both locales, the alt text is translated. */
export function image(opts: GroupFieldOptions = {}) {
  return groupOfKind('image', {
    media: mediaRef('image', { label: 'Image' }),
    alt: text({ label: 'Alt text', help: 'Describes the image for people who cannot see it' }),
  }, opts);
}

/** A video with its poster image, optional captions file and an autoplay switch. */
export function video(opts: GroupFieldOptions = {}) {
  return groupOfKind('video', {
    media: mediaRef('video', { label: 'Video' }),
    poster: mediaRef('image', { label: 'Poster image' }),
    captions: optional(mediaRef('captions', { label: 'Captions' })),
    autoplay: flag({ label: 'Autoplay' }),
  }, opts);
}

/** A true/false switch. */
export function flag(opts: ContainerFieldOptions = {}) {
  const schema = z.boolean();
  schema.register(cmsFields, { kind: 'flag', ...opts, shared: opts.shared ?? true });
  return schema;
}

const BLOCK_DISCRIMINATOR = 'type';

/** A block: a group whose first key is its shared `type`. */
function variant<const T extends string, S extends Record<string, z.ZodType>>(type: T, shape: S) {
  return group({ type: choice([type] as [T]), ...shape });
}

/**
 * The flexible zone of a page: an ordered list of blocks, each a group of one
 * of six `type`s (text, image, video, callout, faq, cta). The `type` is shared,
 * so both locales hold the same blocks in the same order; their translatable
 * text differs. Walk it with walkSchema (the `union` node, then the variant that
 * matches each value's type) and get one variant's schema from blockVariants().
 */
export function blocks(opts: ContainerFieldOptions = {}) {
  const options = [
    variant('text', { body: richText({ label: 'Text' }) }),
    variant('image', { image: image(), caption: optional(text({ label: 'Caption' })) }),
    variant('video', { video: video(), caption: optional(text({ label: 'Caption' })) }),
    variant('callout', { tone: choice(['info', 'warn'], { label: 'Tone' }), body: richText({ label: 'Text' }) }),
    variant('faq', { items: list(group({ q: text({ label: 'Question' }), a: richText({ label: 'Answer' }) }), { label: 'Questions' }) }),
    variant('cta', {
      title: text({ label: 'Title' }),
      body: multiline({ label: 'Text' }),
      label: text({ label: 'Button label' }),
      href: href({ label: 'Button link' }),
    }),
  ] as const;
  const names = options.map((o) => fieldMeta(o.shape.type).options![0]);
  const union = z.discriminatedUnion(BLOCK_DISCRIMINATOR, options);
  union.register(cmsFields, { kind: 'union', discriminator: BLOCK_DISCRIMINATOR, variants: names });
  const schema = z.array(union);
  schema.register(cmsFields, { kind: 'blocks', ...opts, discriminator: BLOCK_DISCRIMINATOR, variants: names });
  return schema;
}

/**
 * `inner`, but the key may be absent (mirrors `?:` in a copy interface). The
 * wrapper carries the inner field's metadata plus `optional: true`, so every
 * node of a schema tree resolves through fieldMeta().
 */
export function optional<T extends z.ZodType>(inner: T) {
  const schema = inner.optional();
  cmsFields.add(schema as z.ZodType, { ...fieldMeta(inner), optional: true });
  return schema;
}

/** Metadata of a schema built by one of the constructors above. */
export function fieldMeta(schema: z.ZodType): FieldMeta {
  const meta = cmsFields.get(schema);
  if (!meta) throw new Error('fieldMeta: schema is not a CMS field (build it with text/multiline/richText/href/mediaRef/image/video/list/group/tuple/choice/flag/blocks/optional)');
  // zod's registry types tuples in metadata as arrays (pairs); the value is ours.
  return meta as FieldMeta;
}
