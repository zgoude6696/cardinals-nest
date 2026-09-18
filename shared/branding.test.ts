import assert from 'node:assert/strict';
import { resolveTeamBrand, TEAM_BRAND } from './branding';

const legacy = {
  teamNumber: 10991, teamName: 'piobyte', themeColor: '#dc2626', logoUrl: null,
  departments: [{ name: 'Custom department', color: '#123456' }],
  roles: [{ name: 'Custom role', tier: 'member' }], timezone: 'America/Los_Angeles',
};
const original = structuredClone(legacy);
const resolved = resolveTeamBrand(legacy);
assert.deepEqual(legacy, original, 'reading branding must not mutate stored settings');
assert.equal(resolved.teamNumber, 6696);
assert.equal(resolved.logoUrl, TEAM_BRAND.logoUrl);
assert.equal(resolved.departments, legacy.departments);
assert.equal(resolved.roles, legacy.roles);
assert.equal(resolved.timezone, legacy.timezone);
const custom = { ...legacy, teamNumber: 6696, teamName: 'Custom name', logoUrl: '/custom.png' };
assert.equal(resolveTeamBrand(custom), custom, 'custom settings must remain intact');
assert.equal(resolveTeamBrand({ ...legacy, teamName: 'Another team' }).teamNumber, 10991,
  'a scouted or explicitly configured other team must not be renamed by number alone');
console.log('Branding compatibility checks passed.');
