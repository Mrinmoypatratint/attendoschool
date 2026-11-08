/** Prints SQL VALUES lists for migration 051 from the catalog (keeps SQL and catalog in sync). */
import { PERMISSIONS, FEATURES, validateCatalog } from '../../src/rbac/catalog';
const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;
console.log(PERMISSIONS.map((p) => `  (${q(p.key)}, ${q(`[${p.feature}] ${p.label}`)})`).join(',\n'));
console.log('---');
console.log(FEATURES.filter((f) => !f.core).map((f) => `(${q(f.key)})`).join(', '));
console.log('---');
console.log(JSON.stringify(validateCatalog()));
