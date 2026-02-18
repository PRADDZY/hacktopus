import assert from 'node:assert/strict';
import { safeJsonParse } from '../../lib/storage';

export const run = () => {
  assert.equal(safeJsonParse(null), null);
  assert.equal(safeJsonParse(''), null);
  assert.equal(safeJsonParse('   '), null);
  assert.equal(safeJsonParse('not-json'), null);

  const parsed = safeJsonParse<{ ok: boolean; count: number }>('{"ok":true,"count":3}');
  assert.deepEqual(parsed, { ok: true, count: 3 });
};
