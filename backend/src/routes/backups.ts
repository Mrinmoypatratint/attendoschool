import { Router } from 'express';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { backupManager, requireBackupOwner } from '../services/backupService';
export function createBackupRouter(managerFactory = backupManager, audit: (...args: any[]) => Promise<any> = async (...args) => {
  const { logSystemAudit } = await import('./superAdmin');
  return (logSystemAudit as any)(...args);
}) {
const router = Router();
router.use((req, res, next) => {
  try { requireBackupOwner((req as any).user); res.setHeader('Cache-Control', 'no-store'); next(); }
  catch { res.status(403).json({ message: 'Super Admin access required for backups' }); }
});
const error = (res: any, e: any) => res.status(e.code === 'ENOENT' ? 404 : e.status || 500).json({ message: e.code === 'ENOENT' ? 'Backup not found' : e.message });
const list = async (_req: any, res: any) => {
  try { const manager = managerFactory(); res.json({ encrypted: Boolean(manager.env.BACKUP_AGE_RECIPIENT), jobs: await manager.list() }); }
  catch (e) { error(res, e); }
};
router.get('/', list);
router.get('/jobs', list);
const create = async (req: any, res: any) => {
  try {
    const who = { id: req.user.id, name: req.user.name || req.user.email };
    const row = await managerFactory().enqueue(who);
    await audit(req.user, 'BACKUP_REQUESTED', 'BACKUP', row.id, { backupId: row.id, size: 0, encrypted: row.encrypted });
    res.status(202).json(row);
  } catch (e) { error(res, e); }
};
router.post('/create', create);
router.post('/trigger', create);
router.get('/:id/download', async (req: any, res) => {
  try {
    const manager = managerFactory(); await manager.init();
    const { row, file } = await manager.download(req.params.id);
    await manager.audit('BACKUP_DOWNLOAD', row, { id: req.user.id, name: req.user.name || req.user.email });
    await audit(req.user, 'BACKUP_DOWNLOAD', 'BACKUP', row.id, { backupId: row.id, size: row.size, encrypted: row.encrypted });
    res.setHeader('Content-Disposition', `attachment; filename="${row.fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', row.size);
    await pipeline(fs.createReadStream(file), res);
  } catch (e) { if (!res.headersSent) error(res, e); else res.destroy(); }
});
// No restore/cleanup endpoint: recovery always targets a separate database, offline.
return router;
}
export default createBackupRouter();
