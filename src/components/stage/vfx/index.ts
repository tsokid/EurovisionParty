// Stage VFX. Import from here (not from components/stage) so public pages
// never pull it in; the engine itself is a separate lazily loaded chunk.
export { StageVfx, loadVfxRuntime } from './StageVfx';
export type { StageVfxHandle, StageVfxProps } from './StageVfx';
export type { VfxPreset, PresetOpts } from './presets';
