// The optional `extraBlocks` zone of a static page: nothing at all when the
// page has none, so pages without them render byte for byte as before.
// Placed by the page before its related links or call to action.
import Blocks from './Blocks';
import type { CmsBlock } from './mediaTypes';

export default function ExtraBlocks({ value }: { value: unknown }) {
  // A doc's extraBlocks as published (validated by its doc type); typed loosely like the editorial layer's.
  return Array.isArray(value) && value.length ? <Blocks value={value as readonly CmsBlock[]} /> : null;
}
