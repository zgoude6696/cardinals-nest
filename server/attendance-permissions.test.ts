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
Object.assign(storage, {
  getUser: async () => ({ id: 1, roles }),
  getGeneralTasks: async () => [],
  deleteGeneralTask: async () => { writes++; },
  getTrainerScopes: async () => scopes,
  getCertification: async () => ({ id: 5, department: 'Mechanical', level: 1 }),
  getCertifications: async () => [{ id: 5, department: 'Mechanical', level: 1 }],
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
  console.log('Attendance role and certification authorization route checks passed.');
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
