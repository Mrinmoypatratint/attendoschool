import { Router } from 'express';
import { AuthRequest, requireAuth, requireRoles } from '../middleware/auth';
import { FEATURES, featureDependents } from '../rbac/catalog';
import {
  AccessError, applyGlobalChanges, applyPlanChanges, applySchoolFeatureChanges, canonicalSchool,
  getEnforcementMode, isOverrideActive, loadSchoolContext, resolveFeature,
} from '../rbac/accessService';
import { getAccessStore } from '../rbac/accessStore';
import { getPrincipalDirectory } from '../rbac/principalDirectory';
import { actorOf, sendAccessError } from './access';

/** /api/super-admin/features — SUPER_ADMIN feature control (plans, schools, global kill switches). */
const r = Router();
r.use(requireAuth, requireRoles('SUPER_ADMIN'));

r.get('/catalog', async (_req, res) => {
  try {
    res.json({ mode: getEnforcementMode(), store: await getAccessStore().status(), features: FEATURES.map((f) => ({ ...f, dependents: featureDependents(f.key) })) });
  } catch (err) { sendAccessError(res, err); }
});

r.get('/plans', async (_req, res) => {
  try {
    const store = getAccessStore();
    const [plans, matrix] = await Promise.all([store.listPlans(), store.listAllPlanFeatures()]);
    res.json({
      plans,
      features: FEATURES.filter((f) => !f.core).map((f) => ({ key: f.key, label: f.label, dependsOn: f.dependsOn || [], dependents: featureDependents(f.key) })),
      matrix: Object.fromEntries(plans.map((p) => [p.planKey, Object.fromEntries(FEATURES.filter((f) => !f.core).map((f) => {
        const v = matrix[p.planKey]?.[f.key];
        return [f.key, v === undefined ? f.defaultEnabled : v];
      }))])),
    });
  } catch (err) { sendAccessError(res, err); }
});

r.put('/plans/:planKey', async (req: AuthRequest, res) => {
  try { res.json({ ok: true, ...(await applyPlanChanges(actorOf(req), String(req.params.planKey), req.body?.changes)) }); }
  catch (err) { sendAccessError(res, err); }
});

async function schoolScope(raw: string) {
  const sid = canonicalSchool(raw);
  if (!sid) throw new AccessError(400, 'SCHOOL_REQUIRED', 'schoolId is required.');
  if (!(await getPrincipalDirectory().schoolExists(sid))) throw new AccessError(404, 'SCHOOL_NOT_FOUND', 'School not found.');
  return sid;
}

r.get('/schools/:schoolId', async (req, res) => {
  try {
    const schoolId = await schoolScope(String(req.params.schoolId));
    const store = getAccessStore();
    const ctx = await loadSchoolContext(schoolId);
    const planKey = await store.getPlanKey(schoolId);
    const planFeatures = planKey ? await store.loadPlanFeatures(planKey) : null;
    const now = Date.now();
    const fin = { now, globalFeatures: ctx.globalFeatures, schoolOverrides: ctx.schoolOverrides, planFeatures };
    const finNoOverride = { ...fin, schoolOverrides: {} };
    res.json({
      schoolId, planKey, version: ctx.version,
      features: FEATURES.map((f) => {
        const o = ctx.schoolOverrides[f.key];
        return {
          key: f.key, label: f.label, core: f.core, dependsOn: f.dependsOn || [],
          override: o ? { ...o, active: isOverrideActive(o, now) } : null,
          inherited: resolveFeature(f.key, finNoOverride),
          effective: resolveFeature(f.key, fin),
        };
      }),
    });
  } catch (err) { sendAccessError(res, err); }
});

r.put('/schools/:schoolId', async (req: AuthRequest, res) => {
  try {
    const schoolId = await schoolScope(String(req.params.schoolId));
    res.json({ ok: true, ...(await applySchoolFeatureChanges(actorOf(req), schoolId, req.body?.changes)) });
  } catch (err) { sendAccessError(res, err); }
});

r.get('/global', async (_req, res) => {
  try {
    const ctx = await getAccessStore().loadSchoolContext('__platform__');
    res.json({ features: FEATURES.filter((f) => !f.core).map((f) => ({ key: f.key, label: f.label, enabled: ctx.globalFeatures[f.key] !== false, dependents: featureDependents(f.key) })) });
  } catch (err) { sendAccessError(res, err); }
});

r.put('/global', async (req: AuthRequest, res) => {
  try { res.json({ ok: true, ...(await applyGlobalChanges(actorOf(req), req.body?.changes, req.body?.reason, req.body?.confirm)) }); }
  catch (err) { sendAccessError(res, err); }
});

r.get('/audit', async (req, res) => {
  try {
    const p = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const schoolId = typeof req.query.schoolId === 'string' && req.query.schoolId ? canonicalSchool(req.query.schoolId) : null;
    res.json(await getAccessStore().listAudit(schoolId, p, 25, typeof req.query.target === 'string' ? req.query.target : undefined));
  } catch (err) { sendAccessError(res, err); }
});

export default r;
