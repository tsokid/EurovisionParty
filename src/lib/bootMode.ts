export function bootMode(root: HTMLElement): 'hydrate' | 'render' {
  return root.dataset.prerendered === 'true' ? 'hydrate' : 'render';
}
