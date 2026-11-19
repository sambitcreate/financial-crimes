import { loadArchetype } from '../archetypes/index';
import type { ArtAspect, ArtMode, InteractiveArtSpec } from '../shared/types';

const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)';

export class FcArtElement extends HTMLElement {
  private abortCtrl: AbortController | null = null;
  private observer: IntersectionObserver | null = null;
  private mounted = false;
  private mounting = false;
  private specCache: InteractiveArtSpec | null = null;
  private modalEl: HTMLDialogElement | null = null;

  connectedCallback(): void {
    const mode = this.getMode();

    // Wire chrome controls (Table / Reset / Expand) if present
    this.wireChrome();

    // mode="thumb": 0ms JS mount at load — keep crisp build-time SSR SVG!
    // Subtle ink micro-motion on pointerenter only.
    if (mode === 'thumb') {
      this.addEventListener('pointerenter', () => this.classList.add('fc-thumb-hover'), { passive: true });
      this.addEventListener('pointerleave', () => this.classList.remove('fc-thumb-hover'), { passive: true });
      return;
    }

    // mode="inline" & mode="hero": lazy mount when near viewport + pause when offscreen
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.setPaused(false);
              if (!this.mounted && !this.mounting) {
                void this.mountInteractive();
              }
            } else if (this.mounted) {
              this.setPaused(true);
            }
          }
        },
        { rootMargin: '140px 0px', threshold: 0.01 }
      );
      this.observer.observe(this);
    } else {
      void this.mountInteractive();
    }
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.unmountInteractive();
    if (this.modalEl?.open) {
      this.modalEl.close();
    }
    this.modalEl?.remove();
    this.modalEl = null;
  }

  private getMode(): ArtMode {
    const m = this.dataset.mode;
    if (m === 'hero' || m === 'thumb') return m;
    return 'inline';
  }

  private getAspect(): ArtAspect {
    const a = this.dataset.aspect;
    if (a === '4/5' || a === '16/9' || a === '16/10' || a === '1/1' || a === '4/3') return a;
    return '16/9';
  }

  private getSeed(): string {
    return this.dataset.id || 'financial-crimes';
  }

  private readSpec(): InteractiveArtSpec | null {
    if (this.specCache) return this.specCache;
    const script = this.querySelector('script.fc-art-spec[type="application/json"]');
    if (!script?.textContent) return null;
    try {
      this.specCache = JSON.parse(script.textContent) as InteractiveArtSpec;
      return this.specCache;
    } catch {
      return null;
    }
  }

  private getMountHost(): HTMLElement | null {
    return this.querySelector<HTMLElement>('.fc-art-mount');
  }

  private setPaused(paused: boolean): void {
    const host = this.getMountHost();
    if (host) {
      host.dataset.paused = paused ? 'true' : 'false';
    }
  }

  private isReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.(REDUCED_MOTION_MQ).matches;
  }

  private unmountInteractive(): void {
    this.abortCtrl?.abort();
    this.abortCtrl = null;
    this.mounted = false;
  }

  public async mountInteractive(targetHost?: HTMLElement, aspectOverride?: ArtAspect): Promise<void> {
    const spec = this.readSpec();
    const host = targetHost || this.getMountHost();
    if (!spec || !host) return;

    if (!targetHost) {
      if (this.mounting) return;
      this.mounting = true;
      this.unmountInteractive();
      this.abortCtrl = new AbortController();
    }

    const ctrl = targetHost ? new AbortController() : this.abortCtrl!;
    try {
      const mod = await loadArchetype(spec.archetype);
      if (ctrl.signal.aborted) return;
      host.dataset.paused = 'false';
      mod.mount(host, spec, {
        seed: this.getSeed(),
        mode: this.getMode(),
        aspect: aspectOverride || this.getAspect(),
        reducedMotion: this.isReducedMotion(),
        signal: ctrl.signal,
      });
      if (!targetHost) {
        this.mounted = true;
        this.classList.add('is-interactive');
      }
    } catch (err) {
      // Fall back gracefully to build-time SSR SVG if client mount fails
      console.warn('[fc-art] fallback to static SVG:', err);
    } finally {
      if (!targetHost) {
        this.mounting = false;
      }
    }
  }

  private wireChrome(): void {
    const resetBtn = this.querySelector<HTMLButtonElement>('[data-fc-action="reset"]');
    const tableBtn = this.querySelector<HTMLButtonElement>('[data-fc-action="table"]');
    const expandBtn = this.querySelector<HTMLButtonElement>('[data-fc-action="expand"]');
    const tableDrawer = this.querySelector<HTMLElement>('.fc-art-table-drawer');
    const closeTableBtn = this.querySelector<HTMLButtonElement>('[data-fc-action="close-table"]');

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this.getMode() === 'thumb') return;
        this.mounted = false;
        void this.mountInteractive();
      });
    }

    if (tableBtn && tableDrawer) {
      const toggleTable = (force?: boolean): void => {
        const nextOpen = force !== undefined ? force : tableDrawer.hasAttribute('hidden');
        if (nextOpen) {
          tableDrawer.removeAttribute('hidden');
          tableBtn.setAttribute('aria-expanded', 'true');
          tableBtn.classList.add('is-active');
        } else {
          tableDrawer.setAttribute('hidden', '');
          tableBtn.setAttribute('aria-expanded', 'false');
          tableBtn.classList.remove('is-active');
        }
      };

      tableBtn.addEventListener('click', () => toggleTable());
      closeTableBtn?.addEventListener('click', () => toggleTable(false));
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !tableDrawer.hasAttribute('hidden')) {
          toggleTable(false);
        }
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', () => this.openFullscreen());
    }
  }

  private openFullscreen(): void {
    const spec = this.readSpec();
    if (!spec) return;

    if (!this.modalEl) {
      const dialog = document.createElement('dialog');
      dialog.className = 'fc-art-lightbox';
      dialog.setAttribute('aria-label', spec.caption || 'Expanded Editorial Illustration');
      dialog.innerHTML = `
        <div class="fc-art-lightbox-bar">
          <span class="fc-art-lightbox-brand">The Financial Crimes · Interactive Plate</span>
          <button type="button" class="fc-art-lightbox-close" aria-label="Close fullscreen view">✕ Close</button>
        </div>
        <div class="fc-art-lightbox-stage"></div>
        ${spec.caption ? `<p class="fc-art-lightbox-caption"></p>` : ''}
      `;
      if (spec.caption) {
        const cap = dialog.querySelector('.fc-art-lightbox-caption');
        if (cap) cap.textContent = spec.caption;
      }
      document.body.appendChild(dialog);
      this.modalEl = dialog;
    }

    const dialog = this.modalEl;
    const stageHost = dialog.querySelector<HTMLElement>('.fc-art-lightbox-stage');
    const closeBtn = dialog.querySelector<HTMLButtonElement>('.fc-art-lightbox-close');
    if (!stageHost) return;

    let modalAbort: AbortController | null = new AbortController();

    const cleanup = (): void => {
      modalAbort?.abort();
      modalAbort = null;
      stageHost.innerHTML = '';
    };

    closeBtn?.addEventListener(
      'click',
      () => {
        dialog.close();
      },
      { once: true }
    );

    dialog.addEventListener('close', cleanup, { once: true });
    dialog.addEventListener(
      'click',
      (e) => {
        if (e.target === dialog) dialog.close();
      },
      { signal: modalAbort.signal }
    );

    dialog.showModal();
    void loadArchetype(spec.archetype).then((mod) => {
      if (!modalAbort || modalAbort.signal.aborted) return;
      mod.mount(stageHost, spec, {
        seed: `${this.getSeed()}:fs`,
        mode: 'hero',
        aspect: '16/9',
        reducedMotion: this.isReducedMotion(),
        signal: modalAbort.signal,
      });
    });
  }
}

export function registerFcArt(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('fc-art')) {
    customElements.define('fc-art', FcArtElement);
  }
}

registerFcArt();
