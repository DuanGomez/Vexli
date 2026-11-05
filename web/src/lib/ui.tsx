import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, onWaking, setToken } from './api';
import type { Session, Store, User } from './types';

// --- Avisos ------------------------------------------------------------------

const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 3200);
  }, []);
  useEffect(() => {
    const off = onWaking(setWaking);
    return () => {
      off();
    };
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {text ? (
        <div className="toast" role="status">
          {text}
        </div>
      ) : waking ? (
        <div className="toast">Despertando el servidor… la primera vez tarda unos segundos</div>
      ) : null}
    </ToastCtx.Provider>
  );
}

// --- Sesión ------------------------------------------------------------------

interface Auth {
  user: User | null;
  store: Store | null;
  ready: boolean;
  start: (s: Session) => void;
  setStore: (s: Store) => void;
  logout: () => void;
}

const AuthCtx = createContext<Auth>({ user: null, store: null, ready: false, start: () => {}, setStore: () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<{ user: User; store: Store }>('/me')
      .then((me) => {
        setUser(me.user);
        setStore(me.store);
      })
      .catch(() => null)
      .finally(() => setReady(true));
  }, []);

  const start = useCallback((s: Session) => {
    setToken(s.token);
    setUser(s.user);
    setStore(s.store);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStore(null);
  }, []);

  return <AuthCtx.Provider value={{ user, store, ready, start, setStore, logout }}>{children}</AuthCtx.Provider>;
}

// --- Piezas ------------------------------------------------------------------

export function Modal({ title, eyebrow, onClose, children, wide }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="dialog" style={wide ? { width: 'min(760px, 100%)' } : undefined} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dialog-head">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2>{title}</h2>
          </div>
          <button className="btn ghost icon sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {text}
    </div>
  );
}

/** Carga datos de la API y los recarga cuando cambian las dependencias. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    loader()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, reload: () => setN((x) => x + 1), setData };
}
