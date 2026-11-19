import { resolveArchetype } from '../shared/normalize';
import type { ArchetypeModule, ArtArchetype } from '../shared/types';

const LOADERS: Record<ArtArchetype, () => Promise<ArchetypeModule>> = {
  'shell-network': () => import('./shell-network'),
  'scale-of-impunity': () => import('./scale-of-impunity'),
  'redacted-dossier': () => import('./redacted-dossier'),
  'pump-dump-ticker': () => import('./pump-dump-ticker'),
  'ponzi-pyramid': () => import('./ponzi-pyramid'),
  'offshore-flight-map': () => import('./offshore-flight-map'),
  'editorial-vignette': () => import('./editorial-vignette'),
  'penalty-wheel': () => import('./penalty-wheel'),
};

export async function loadArchetype(rawName?: string): Promise<ArchetypeModule> {
  const key = resolveArchetype(rawName);
  return LOADERS[key]();
}
