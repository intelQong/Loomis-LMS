// Super admin gating must fail closed. Run: node scripts/test-super-admin.mjs
import assert from 'node:assert/strict';
import { onRequest, isSuperAdminEmail } from '../functions/api/[[path]].js';

// onRequest is what loads SUPER_ADMIN_EMAIL from env, so drive config through it.
const configure = (env) =>
  onRequest({ request: new Request('https://example.test/api/auth/me'), env });

await configure({});
assert.equal(isSuperAdminEmail('admin@example.com'), false, 'placeholder must not be claimable');
assert.equal(isSuperAdminEmail(''), false, 'blank email must not match unset config');
assert.equal(isSuperAdminEmail(null), false, 'null email must not match unset config');

await configure({ SUPER_ADMIN_EMAIL: '  Boss@Example.COM  ' });
assert.equal(isSuperAdminEmail('boss@example.com'), true, 'configured email matches');
assert.equal(isSuperAdminEmail('BOSS@EXAMPLE.COM'), true, 'match is case-insensitive');
assert.equal(isSuperAdminEmail('other@example.com'), false, 'other emails do not match');
assert.equal(isSuperAdminEmail(''), false, 'blank email never matches');

console.log('super admin gating ok');
