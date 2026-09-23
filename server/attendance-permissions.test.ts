// Route-level regression checks with in-memory storage; never uses a real database.
import assert from 'node:assert/strict';
import express from 'express';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
const { storage } = await import('./storage');
const { pool } = await import('./db');
const { default: time } = await import('./routes/time');
const { default: certifications } = await import('./routes/certifications');
let roles: string[] = [];
let scopes: any[] = [];
let writes = 0;
let certLevel = 1;
Object.assign(storage, {
  getUser: async () => ({ id: 1, roles }),
  getGeneralTasks: async () => [],
  deleteGeneralTask: async () => { writes++; },
  getTrainerScopes: async () => scopes,
  getCertification: async () => ({ id: 5, department: 'Mechanical', level: certLevel }),
  getCertifications: async () => [{ id: 5, department: 'Mechanical', level: certLevel }],
  createCertification: async (data: any) => ({ id: 5, ...data }),
  updateCertification: async (id: number, data: any) => ({ id, ...data }),
  getTeamSettings: async () => ({ departments: [{ name: 'Mechanical' }] }),
  setTrainerScopes: async (_id: number, saved: any[]) => saved,
  getUserBadges: async () => [],
  grantCertificationWithBadges: async () => { writes++; return { row: { id: 1 }, newBadges: [] }; },
});
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.userId = 1; req.userRoles = roles; next(); });
app.use(time, certifications);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, method = 'GET', body?: object) {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}
try {
  for (const role of ['Coach', 'Team Captain', 'Department Head', 'Team Member']) {
    roles = [role];
    const expected = ['Coach', 'Team Captain'].includes(role) ? 200 : 403;
    assert.equal((await request('/general-tasks?includeArchived=true&requesterId=1')).status, expected, role);
    assert.equal((await request('/general-tasks/4', 'DELETE', { deletedBy: 1 })).status, expected, role);
  }
  assert.equal(writes, 2, 'Only coach and captain may delete attendance tasks');
  for (const leader of ['Team Captain', 'Department Head']) {
    scopes = [{ department: 'Mechanical', maxLevel: 1 }];
    roles = [leader];
    assert.equal((await request('/users/2/certifications', 'POST', { certId: 5, grantedBy: 1 })).status, 403, 'Leadership alone cannot approve');
    roles = [leader, 'Trainer'];
    scopes = [];
    assert.equal((await request('/users/2/certifications', 'POST', { certId: 5, grantedBy: 1 })).status, 403, 'Trainer needs scope');
    scopes = [{ department: 'Software', maxLevel: 3 }];
    assert.equal((await request('/users/2/certifications', 'POST', { certId: 5, grantedBy: 1 })).status, 403, 'Wrong department denied');
    scopes = [{ department: 'Mechanical', maxLevel: 1 }];
    assert.equal((await request('/users/2/certifications', 'POST', { certId: 5, grantedBy: 1 })).status, 201, 'Authorized leader/trainer can approve');
  }
  assert.equal(writes, 4, 'Denied grants never write');
  for (const level of [4, 5]) {
    roles = ['Coach'];
    const created = await request('/certifications', 'POST', {
      name: `Level ${level} skill`, department: 'Mechanical', level, createdBy: 1,
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).level, level, 'Creating retains upper levels');
    const updated = await request('/certifications/5', 'PUT', { level, requesterId: 1 });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).level, level, 'Editing retains upper levels');
    const saved = await request('/users/2/trainer-scopes', 'PUT', {
      scopes: [{ department: 'Mechanical', maxLevel: level }],
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json())[0].maxLevel, level, 'Scopes retain upper levels');

    certLevel = level;
    roles = ['Trainer'];
    scopes = [{ department: 'Mechanical', maxLevel: level - 1 }];
    const before = writes;
    assert.equal((await request('/users/2/certifications', 'POST', { certId: 5, grantedBy: 1 })).status, 403);
    assert.equal(writes, before, 'A lower trainer scope cannot grant an upper-level certification');
    scopes = [{ department: 'Mechanical', maxLevel: level }];
    assert.equal((await request('/users/2/certifications', 'POST', { certId: 5, grantedBy: 1 })).status, 201);
    assert.equal(writes, before + 1, 'The matching trainer scope can grant it when prerequisites are empty');
  }
  console.log('Attendance role and certification authorization route checks passed.');
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
