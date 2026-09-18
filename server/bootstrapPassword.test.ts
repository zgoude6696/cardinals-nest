import assert from 'node:assert/strict';
import { demoBootstrapPassword } from './bootstrapPassword';
assert.equal(demoBootstrapPassword('development'), 'changeme');
assert.throws(() => demoBootstrapPassword('production'));
assert.throws(() => demoBootstrapPassword('production', 'changeme'));
assert.equal(demoBootstrapPassword('production', 'test-only-passphrase'), 'test-only-passphrase');
console.log('Hosted bootstrap password checks passed.');
