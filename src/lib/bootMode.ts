export function bootMode(root: HTMLElement): 'hydrate' | 'render' {
  return root.dataset.prerendered === 'true' ? 'hydrate' : 'render';
}

export type BootMode = ReturnType<typeof bootMode>;

/**
 * Run `prepare` (e.g. switching i18n to the URL's language), then mount in the
 * mode #root asks for. Any failure is logged and the app is still mounted with
 * a fresh client render, so the page never stays blank.
 */
export async function startApp(
  root: HTMLElement,
  prepare: () => Promise<unknown>,
  mount: (mode: BootMode) => void,
): Promise<void> {
  let mode: BootMode | null = null;
  try {
    await prepare();
    mode = bootMode(root);
    mount(mode);
  } catch (err) {
    console.error('boot failed; falling back to client render', err);
    if (mode !== 'render') mount('render');
  }
}
