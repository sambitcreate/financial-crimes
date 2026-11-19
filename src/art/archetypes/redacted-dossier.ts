import { applyStagePalette, createEl } from '../shared/dom-ui';
import { renderStippleIconSvg } from '../shared/icons';
import { normalizeRedactedDossier } from '../shared/normalize';
import { getPalette } from '../shared/palette';
import { createPrng } from '../shared/prng';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizeRedactedDossier(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const rng = createPrng(`${opts.seed}:redacted-dossier`);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-dossier');
  applyStagePalette(stage, pal);

  // Authentic archival court exhibit sheet
  const sheet = createEl('div', 'fc-dossier-sheet');

  // Top Exhibit Header
  const header = createEl('div', 'fc-dossier-header');
  const headerLeft = createEl('div', 'fc-dossier-header-left');
  headerLeft.append(
    createEl('div', 'fc-dossier-kicker', data.exhibitLabel),
    createEl('div', 'fc-dossier-subject', data.subject)
  );
  const docketBadge = createEl('div', 'fc-dossier-docket', data.docketNumber);
  header.append(headerLeft, docketBadge);
  sheet.appendChild(header);

  // Body grid: Left stipple engraving medallion + Right interactive redacted lines
  const body = createEl('div', 'fc-dossier-body');

  const iconCol = createEl('div', 'fc-dossier-icon-col');
  const iconSvg = `<svg viewBox="0 0 210 210" width="168" height="168" aria-hidden="true">${renderStippleIconSvg(data.icon, 105, 105, 178, pal, rng)}</svg>`;
  iconCol.innerHTML = iconSvg;
  const counterEl = createEl('div', 'fc-dossier-counter', `0 / ${data.excerpts.length} DECLASSIFIED`);
  iconCol.appendChild(counterEl);

  const stampEl = createEl('div', 'fc-dossier-stamp', data.stamp);
  iconCol.appendChild(stampEl);
  body.appendChild(iconCol);

  const linesCol = createEl('div', 'fc-dossier-lines');
  const revealed = new Set<number>();

  const inspector = createEl(
    'div',
    'fc-inspector-card',
    'Hover, scratch across, or click any black ink redaction bar to reveal verbatim public-filing text.'
  );

  function updateStatus(activeNote?: string): void {
    counterEl.textContent = `${revealed.size} / ${data.excerpts.length} DECLASSIFIED`;
    const allOpen = revealed.size >= data.excerpts.length;
    declassifyBtn.textContent = allOpen ? 'Re-Redact Sheet' : 'Declassify All';
    stampEl.classList.toggle('is-stamped', allOpen);
    if (activeNote) {
      inspector.innerHTML = `<span class="fc-insp-kicker">FILING NOTE</span> ${activeNote}`;
    }
  }

  const barButtons: HTMLButtonElement[] = [];

  data.excerpts.forEach((ex, idx) => {
    const row = createEl('div', 'fc-dossier-row');
    const ref = createEl('div', 'fc-dossier-ref', ex.label || `EXCERPT 0${idx + 1}`);
    const para = createEl('p', 'fc-dossier-quote');

    if (ex.prefix) {
      para.appendChild(document.createTextNode(ex.prefix));
    }

    const bar = createEl('button', 'fc-redaction-bar');
    bar.type = 'button';
    bar.setAttribute('aria-pressed', 'false');
    bar.setAttribute('aria-label', `Reveal redacted text: ${ex.label || `Excerpt ${idx + 1}`}`);

    const textSpan = createEl('span', 'fc-redaction-text', ex.redacted);
    const inkCover = createEl('span', 'fc-redaction-ink');
    inkCover.setAttribute('aria-hidden', 'true');
    bar.append(textSpan, inkCover);

    const reveal = (): void => {
      if (!revealed.has(idx)) {
        revealed.add(idx);
        bar.classList.add('is-revealed');
        bar.setAttribute('aria-pressed', 'true');
        updateStatus(ex.note || 'Public court docket excerpt.');
      }
    };

    bar.addEventListener(
      'click',
      () => {
        if (revealed.has(idx)) {
          revealed.delete(idx);
          bar.classList.remove('is-revealed');
          bar.setAttribute('aria-pressed', 'false');
          updateStatus('Excerpt re-redacted.');
        } else {
          reveal();
        }
      },
      { signal: opts.signal }
    );

    bar.addEventListener(
      'pointerenter',
      (e) => {
        // Scratch-to-reveal on desktop pointer hover or touch drag
        if (e.pointerType === 'mouse' || e.buttons > 0) {
          reveal();
        }
      },
      { signal: opts.signal }
    );

    barButtons.push(bar);
    para.appendChild(bar);

    if (ex.suffix) {
      para.appendChild(document.createTextNode(ex.suffix));
    }

    row.append(ref, para);
    linesCol.appendChild(row);
  });

  body.appendChild(linesCol);
  sheet.appendChild(body);
  stage.appendChild(sheet);

  // Toolbar
  const toolbar = createEl('div', 'fc-inline-toolbar');
  const declassifyBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', 'Declassify All');
  declassifyBtn.type = 'button';
  declassifyBtn.addEventListener(
    'click',
    () => {
      const shouldRevealAll = revealed.size < data.excerpts.length;
      barButtons.forEach((btn, i) => {
        if (shouldRevealAll) {
          revealed.add(i);
          btn.classList.add('is-revealed');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          revealed.delete(i);
          btn.classList.remove('is-revealed');
          btn.setAttribute('aria-pressed', 'false');
        }
      });
      updateStatus(
        shouldRevealAll
          ? 'All public-filing excerpts unsealed. Source: Official agency/court docket.'
          : 'All excerpts re-masked.'
      );
    },
    { signal: opts.signal }
  );
  toolbar.appendChild(declassifyBtn);
  stage.append(toolbar, inspector);

  container.appendChild(stage);
}
