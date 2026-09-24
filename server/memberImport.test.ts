// In-memory route/storage tests: never connects to a real database.
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
const { storage } = await import('./storage');
const { pool } = await import('./db');
const { validateMemberCsv } = await import('./memberImport');
const { default: routes } = await import('./routes/users');
const { authenticate } = await import('./middleware/auth');
const { signSession, SESSION_COOKIE, verifyPassword } = await import('./security');
const settings = { roles: [{ name: 'Coach' }, { name: 'Team Captain' }, { name: 'Team Member' }], departments: [{ name: 'Mechanical' }, { name: 'Software' }] };
const header = 'First Name,Last Name,Username,Initial Password,Roles,Subteams';
const secret = 'test-only-password';
const row = (username: string, roles = 'Team Member', subteams = 'Mechanical') => `Jane,Doe,${username},${secret},${roles},${subteams}`;
const file = (...rows: string[]) => [header, ...rows].join('\r\n');
const validate = (csv: string, existing: string[] = []) => validateMemberCsv(csv, settings, existing);
assert.equal(validate(file(row('one'))).rows[0].report.status, 'ready');
assert.equal(validate(file(row('one'), row('two'))).rows.length, 2);
const multi = validate(file(row(' MULTI ', 'team captain; Team Member', ' software ;Mechanical'))).rows[0].report;
assert.deepEqual(multi.roles, ['Team Captain', 'Team Member']);
assert.deepEqual(multi.subteams, ['Software', 'Mechanical']);
assert.equal(multi.username, 'multi');
assert.ok(validate(file(row('dup'), row('DUP'))).rows.every(r => r.report.errors.includes('Duplicate username in CSV')));
assert.equal(validate(file(row('existing')), ['Existing']).rows[0].report.existingUsername, true);
assert.match(validate(file(row('bad', 'Bogus'))).rows[0].report.errors.join(), /Unknown role/);
assert.match(validate(file(row('bad', 'Team Member', 'Bogus'))).rows[0].report.errors.join(), /Unknown subteam/);
assert.equal(validate(file(`"Jane, Jr.","D""oe",quoted,${secret},Team Member,"Mechanical;Software"`)).rows[0].report.name, 'Jane, Jr. D"oe');
assert.ok(validate(file(row('one')).replace('First Name,', '')).errors.some(e => e.includes('Missing required column')));
assert.ok(validate('').errors.length);
assert.ok(validate(header).errors.length);
assert.ok(validate(file(row('one') + ',extra')).rows[0].report.errors.length);
assert.ok(validate(file('"unclosed')).errors.length);
assert.ok(validate(file(row('one', ';'))).rows[0].report.errors.length);
assert.ok(validate(file(row(''))).rows[0].report.errors.length);
assert.ok(validate(file(row('one')).replace(secret, 'short')).rows[0].report.errors.length);
assert.ok(validate(file(...Array.from({length:101}, (_,i)=>row(`u${i}`)))).errors.length);
assert.equal(validate('\uFEFF' + file(row('bom')) + '\n\n').rows[0].report.status, 'ready');

const users: any[] = [{ id: 1, username: 'existing', password: 'stored', name: 'Existing', roles: [], departments: [] }];
let failure = '';
Object.assign(storage, {
  getTeamSettings: async () => settings,
  getUsers: async () => users,
  getUserByUsername: async (username: string) => users.find(u => u.username === username),
  createUser: async (data: any) => {
    if (data.username === failure) throw new Error(`DB details that must not escape: ${secret}`);
    if (users.some(u => u.username === data.username)) throw { cause: { code: '23505' } };
    const user = { ...data, id: users.length + 1 }; users.push(user); return user;
  },
});
const app = express(); app.use(express.json(), cookieParser(), authenticate, routes);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
async function request(path: string, body: object, roles?: string[], guest = false) {
  const token = guest ? signSession({ kind: 'guest', eventId: 1 }) : roles ? signSession({ kind: 'member', userId: 1, roles }) : '';
  if (path.endsWith('/commit')) body = { selectedRows: [2,3,4,5,6], ...body };
  return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `${SESSION_COOKIE}=${token}` }, body: JSON.stringify(body) });
}
try {
  for (const phase of ['preview', 'commit']) {
    assert.equal((await request(`/users/import/${phase}`, { csv: file(row('no')) })).status, 401);
    assert.equal((await request(`/users/import/${phase}`, { csv: file(row('no')) }, ['Team Member'])).status, 403);
    assert.equal((await request(`/users/import/${phase}`, { csv: file(row('no')) }, [], true)).status, 403);
  }
  const batch = file(row('one'), row('two', 'Team Captain;Team Member', 'Software;Mechanical'), row('existing'), row('fail'), row('after'));
  const preview = await request('/users/import/preview', { csv: batch }, ['Team Captain']);
  assert.equal(preview.status, 200);
  assert.equal(users.length, 1, 'Preview never writes');
  assert.ok(!(await preview.text()).includes(secret), 'Preview never returns passwords');
  failure = 'fail';
  const result = await request('/users/import/commit', { csv: batch }, ['Team Captain']);
  const text = await result.text(); assert.ok(!text.includes(secret)); assert.ok(!text.includes('$2'));
  const report = JSON.parse(text);
  assert.equal(report.rows.filter((r:any)=>r.status === 'created').length, 3);
  assert.equal(report.rows.filter((r:any)=>r.errors.length).length, 2);
  assert.equal(users.length, 4, 'Failure does not prevent later valid rows');
  assert.equal((await verifyPassword(secret, users[1].password)).ok, true);
  assert.notEqual(users[1].password, secret);
  const retry = await request('/users/import/commit', { csv: batch }, ['Coach']);
  assert.equal((await retry.json()).rows.filter((r:any)=>r.status === 'created').length, 0, 'Retry cannot duplicate existing members');
  assert.equal(users.length, 4);
  // Settings and username checks are fresh on commit, even if preview was ready.
  await request('/users/import/preview', { csv: file(row('changed')) }, ['Coach']);
  settings.departments = [{ name: 'Software' }];
  const changed = await request('/users/import/commit', { csv: file(row('changed')) }, ['Coach']);
  assert.match((await changed.json()).rows[0].errors.join(), /Unknown subteam/);
  const excluded = await request('/users/import/commit', { csv: file(row('excluded', 'Team Member', 'Software')), selectedRows: [] }, ['Coach']);
  assert.equal((await excluded.json()).rows[0].status, 'invalid', 'Commit cannot import rows excluded in preview');
  const manual = await request('/users', { name: 'Manual', username: ' MANUAL ', password: secret, roles: ['Team Member'], departments: [] }, ['Coach']);
  assert.equal(manual.status, 201); assert.ok(!(await manual.text()).includes('password'));
  assert.equal((await verifyPassword(secret, users.at(-1).password)).ok, true);
  console.log('CSV validation, authorization, hashing, preview, partial failure, settings changes and retry checks passed.');
} finally {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await pool.end();
}
