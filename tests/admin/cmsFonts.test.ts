// The owner's font rule: Space Grotesk and Bebas Neue only. The CMS admin
// screens added in Track 3 use no system monospace (final review M7):
// commit SHAs, paths and routes are Space Grotesk with tabular figures.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'src/admin/modules/media/MediaLibrary.tsx',
  'src/admin/modules/pages/form/fields/MediaRefField.tsx',
  'src/admin/publish/DeployState.tsx',
  'src/admin/publish/DiffParts.tsx',
  'src/admin/publish/PublishScreens.tsx',
  'src/admin/seo/SeoPanel.tsx',
];

describe('CMS admin fonts (final review M7)', () => {
  it.each(FILES)('%s uses no font-mono', (file) => {
    const src = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(src).not.toMatch(/\bfont-mono\b/);
  });
});
