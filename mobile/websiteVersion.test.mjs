import test from 'node:test';
import assert from 'node:assert/strict';
import {readWebsiteVersion, loginDestination} from '../features/android/domain/websiteVersion.ts';

test('only a valid deployment identity is used to offer a reload', () => {
  assert.equal(readWebsiteVersion({version:'8f02440d-a2bf-4dc2-9878-caa8c77017e4'}), '8f02440d-a2bf-4dc2-9878-caa8c77017e4');
  for (const value of [null, {}, {version:''}, {version:42}, {version:'<html>error</html>'}, {version:'a'.repeat(129)}]) assert.equal(readWebsiteVersion(value), null);
});
test('notification quick-add survives login without accepting external redirects', () => {
  assert.equal(loginDestination('/todo?create=today'), '/todo?create=today');
  for (const path of [null, 'https://evil.test', '//evil.test', '/\\evil.test', '/todo?create=today&evil=true']) assert.equal(loginDestination(path), '/');
});
