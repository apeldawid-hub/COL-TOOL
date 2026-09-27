// src/services/zoomService.ts

const STORAGE_KEY = 'sbx_ui_zoom_factor';
const MIN_ZOOM = 0.70; // 70%
const MAX_ZOOM = 1.35; // 135%
const DEFAULT_ZOOM = 1.00; // 100%

export interface ZoomPreset {
  label: string;
  value: number;
}

export const ZOOM_PRESETS: ZoomPreset[] = [
  { label: '75%', value: 0.75 },
  { label: '85%', value: 0.85 },
  { label: '90%', value: 0.90 },
  { label: '100% (Domyślny)', value: 1.00 },
  { label: '110%', value: 1.10 },
  { label: '115%', value: 1.15 },
  { label: '125%', value: 1.25 },
];

class ZoomService {
  private zoomFactor: number = DEFAULT_ZOOM;
  private listeners: Array<(zoom: number) => void> = [];

  constructor() {
    this.loadInitialZoom();
    this.initKeyboardShortcuts();
  }

  private loadInitialZoom() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
          this.zoomFactor = Math.round(parsed * 100) / 100;
        }
      }
    } catch {}

    // Zastosuj po załadowaniu drzewa DOM
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => {
        this.applyZoom(this.zoomFactor);
      });
      // Wczesne zastosowanie
      this.applyZoom(this.zoomFactor);
    }
  }

  private applyZoom(factor: number) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(factor * 100) / 100));
    
    // 1. Natywny webFrame w Electronie (jeśli dostępny przez preload)
    const api = (window as any).api || (window as any).electronAPI;
    let appliedViaElectron = false;
    if (api?.setZoomFactor) {
      try {
        appliedViaElectron = Boolean(api.setZoomFactor(clamped));
      } catch (err) {
        console.warn('Nie udało się ustawić zoomFactor przez Electron webFrame:', err);
      }
    }

    // 2. Jeśli Electron obsłużył zoom, czyścimy CSS zoom, aby nie dublować skali.
    // W przeglądarce webowej (gdy brak api.setZoomFactor) stosujemy CSS zoom na korzeniu dokumentu.
    if (typeof document !== 'undefined' && document.documentElement) {
      if (appliedViaElectron) {
        document.documentElement.style.zoom = '';
      } else {
        document.documentElement.style.zoom = String(clamped);
      }
    }
  }

  private initKeyboardShortcuts() {
    if (typeof window === 'undefined') return;

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // Skróty Cmd na Macu lub Ctrl na Windows
        if (e.metaKey || e.ctrlKey) {
          if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            this.zoomIn();
          } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            this.zoomOut();
          } else if (e.key === '0') {
            e.preventDefault();
            this.resetZoom();
          }
        }
      },
      { passive: false }
    );
  }

  public subscribe(listener: (zoom: number) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.zoomFactor);
      } catch (err) {
        console.error('Błąd listenera zoomService:', err);
      }
    });
  }

  public getZoom(): number {
    return this.zoomFactor;
  }

  public getZoomPercent(): number {
    return Math.round(this.zoomFactor * 100);
  }

  public setZoom(factor: number): number {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(factor * 100) / 100));
    this.zoomFactor = clamped;

    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {}

    this.applyZoom(clamped);
    this.notify();
    return clamped;
  }

  public zoomIn(step: number = 0.05): number {
    return this.setZoom(this.zoomFactor + step);
  }

  public zoomOut(step: number = 0.05): number {
    return this.setZoom(this.zoomFactor - step);
  }

  public resetZoom(): number {
    return this.setZoom(DEFAULT_ZOOM);
  }
}

export const zoomService = new ZoomService();
