/**
 * AccessProvider — loads GET /api/access/me after login and keeps it fresh:
 * on window focus, every 5 minutes, and whenever an RBAC change is saved (ACCESS_CHANGED_EVENT).
 * Kept in memory only (no localStorage).
 *
 * UX gating only: when the backend runs in shadow/off mode, nothing is hidden (the backend would not
 * block either). If the snapshot cannot be loaded, the UI fails OPEN — the backend stays authoritative.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ACCESS_DENIED_EVENT } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { AccessGateContext, accessReasonText } from './accessGate';
import type { AccessCheck, AccessVerdict } from './accessGate';
import { permissionForPath } from './routeAccess';

export const ACCESS_CHANGED_EVENT = 'attendoschool_access_changed';
export const notifyAccessChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACCESS_CHANGED_EVENT));
};

type PermissionState = { key: string; allowed: boolean; reason: string; source: string; feature: string };
type FeatureState = { key: string; enabled: boolean; source: string; blockedBy?: string };
export type AccessSnapshot = {
  version: number; role: string | null; schoolId: string | null; loginEnabled: boolean;
  mode: 'off' | 'shadow' | 'enforce'; planKey: string | null; features: FeatureState[]; permissions: PermissionState[];
};

type AccessContextValue = {
  snapshot: AccessSnapshot | null;
  loading: boolean;
  enforcing: boolean;
  can: (permission: string) => boolean;
  hasFeature: (feature: string) => boolean;
  canPath: (path: string) => boolean;
  verdict: AccessCheck;
  refresh: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue>({
  snapshot: null, loading: false, enforcing: false,
  can: () => true, hasFeature: () => true, canPath: () => true, verdict: () => ({ allowed: true }), refresh: async () => undefined,
});

export function useAccess() { return useContext(AccessContext); }

const FIVE_MINUTES = 5 * 60 * 1000;

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [snapshot, setSnapshot] = useState<AccessSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const userKey = user ? `${user.id}:${user.role}:${user.schoolId || ''}` : '';

  const refresh = useCallback(async () => {
    if (!userKey) { setSnapshot(null); return; }
    if (inflight.current) return inflight.current;
    setLoading(true);
    inflight.current = api.get('/access/me')
      .then((r) => setSnapshot(r.data as AccessSnapshot))
      .catch(() => { /* fail open; backend is authoritative */ })
      .finally(() => { setLoading(false); inflight.current = null; });
    return inflight.current;
  }, [userKey]);

  useEffect(() => {
    setSnapshot(null);
    if (!userKey) return;
    refresh();
    const onFocus = () => refresh();
    const onChanged = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener(ACCESS_CHANGED_EVENT, onChanged);
    const t = window.setInterval(refresh, FIVE_MINUTES);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(ACCESS_CHANGED_EVENT, onChanged);
      window.clearInterval(t);
    };
  }, [userKey, refresh]);

  // Friendly toast for 403 PERMISSION_DENIED / FEATURE_DISABLED (session is never purged).
  useEffect(() => {
    let last = 0;
    const onDenied = (e: Event) => {
      const now = Date.now();
      if (now - last < 2500) return;
      last = now;
      const d = (e as CustomEvent).detail || {};
      addToast(d.code === 'FEATURE_DISABLED' ? accessReasonText('FEATURE_DISABLED') : (d.message || 'You do not have permission to perform this action.'), 'warning');
      refresh();
    };
    window.addEventListener(ACCESS_DENIED_EVENT, onDenied);
    return () => window.removeEventListener(ACCESS_DENIED_EVENT, onDenied);
  }, [addToast, refresh]);

  const value = useMemo<AccessContextValue>(() => {
    const enforcing = snapshot?.mode === 'enforce';
    const perms = new Map((snapshot?.permissions || []).map((p) => [p.key, p]));
    const feats = new Map((snapshot?.features || []).map((f) => [f.key, f]));
    const permVerdict = (key: string): AccessVerdict => {
      if (!enforcing) return { allowed: true };
      const p = perms.get(key);
      if (!p) return { allowed: true }; // not RBAC-managed for this role → legacy guards decide
      if (p.allowed || p.reason === 'CEILING') return { allowed: true };
      return { allowed: false, reason: p.reason, permission: key, feature: p.feature };
    };
    const featVerdict = (key: string): AccessVerdict => {
      if (!enforcing) return { allowed: true };
      const f = feats.get(key);
      return !f || f.enabled ? { allowed: true } : { allowed: false, reason: 'FEATURE_DISABLED', feature: key };
    };
    const verdict: AccessCheck = ({ permission, feature, path }) => {
      if (feature) { const v = featVerdict(feature); if (!v.allowed) return v; }
      const key = permission || (path ? permissionForPath(path) : undefined);
      return key ? permVerdict(key) : { allowed: true };
    };
    return {
      snapshot, loading, enforcing, verdict, refresh,
      can: (k) => permVerdict(k).allowed,
      hasFeature: (k) => featVerdict(k).allowed,
      canPath: (p) => verdict({ path: p }).allowed,
    };
  }, [snapshot, loading, refresh]);

  return (
    <AccessContext.Provider value={value}>
      <AccessGateContext.Provider value={value.verdict}>{children}</AccessGateContext.Provider>
    </AccessContext.Provider>
  );
}

/** <Can perm="students.delete">…</Can> / <Can feature="analytics" fallback={…}>…</Can> */
export function Can({ perm, feature, fallback = null, children }: { perm?: string; feature?: string; fallback?: ReactNode; children: ReactNode }) {
  const { verdict } = useAccess();
  return <>{verdict({ permission: perm, feature }).allowed ? children : fallback}</>;
}
