/** Spoken after the interactive painting's label via aria-describedby. */
export const PAINTING_HINT = 'Press Enter or Space to reveal the archival exhibit plate.';

/** Accessible name for the interactive stage: the alt text, never ending in a doubled period. */
export function paintingButtonLabel(alt: string): string {
  const trimmed = String(alt ?? '').trim().replace(/[\s.]+$/, '');
  return trimmed || 'Editorial oil painting';
}
