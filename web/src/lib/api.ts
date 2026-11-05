/** Conexión con la API: en el PC la local; publicada, la de Render. */
export const API_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8020/api' : 'https://vexli-api.onrender.com/api';

const TOKEN_KEY = 'vexli.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado */
  }
}

export class ApiError extends Error {
  status: number;
  canForce: boolean;
  constructor(message: string, status = 0, canForce = false) {
    super(message);
    this.status = status;
    this.canForce = canForce;
  }
}

/** Avisa a la interfaz cuando el servidor gratis está despertando. */
type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();
export function onWaking(fn: WakeListener) {
  wakeListeners.add(fn);
  return () => wakeListeners.delete(fn);
}
let pending = 0;
let wakeTimer: ReturnType<typeof setTimeout> | undefined;

export async function api<T>(path: string, options: { method?: string; body?: unknown; params?: Record<string, unknown> } = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(options.params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const token = getToken();
  pending++;
  clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => wakeListeners.forEach((f) => f(true)), 2500);
  try {
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail?.message ?? (res.status >= 500 ? 'El servidor tuvo un problema. Intenta en un momento.' : 'No se pudo completar.');
      if (res.status === 401) setToken(null);
      throw new ApiError(message, res.status, !!detail?.can_force);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('No se pudo conectar. Revisa tu internet e intenta de nuevo.');
  } finally {
    pending--;
    if (!pending) {
      clearTimeout(wakeTimer);
      wakeListeners.forEach((f) => f(false));
    }
  }
}

/** Descarga un archivo protegido (CSV) con el token. */
export async function download(path: string, filename: string, params: Record<string, unknown> = {}) {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError('No se pudo descargar el archivo.');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
