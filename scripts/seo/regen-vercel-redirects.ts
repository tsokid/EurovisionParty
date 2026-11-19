// Rewrites the generated year redirects in vercel.json from the committed
// content/contests/index.json, exactly as Publish would. For a change to the
// redirect generator that must land before the next Publish.
//   npx tsx scripts/seo/regen-vercel-redirects.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { generatedRedirects, mergeVercelRedirects } from '../../supabase/functions/publish-content/redirects';
import { committedContests } from '../../tests/helpers/committedContests';

const before = readFileSync('vercel.json', 'utf8').replace(/\r\n/g, '\n');
const after = mergeVercelRedirects(before, generatedRedirects(committedContests()));
writeFileSync('vercel.json', after);
console.log(`redirects: ${JSON.parse(before).redirects.length} -> ${JSON.parse(after).redirects.length}`);
