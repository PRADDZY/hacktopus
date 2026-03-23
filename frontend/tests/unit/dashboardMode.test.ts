import assert from 'node:assert/strict';
import { getDashboardMode, setDashboardMode } from '../../lib/dashboardMode';

export const run = () => {
  assert.equal(getDashboardMode(), 'live');

  setDashboardMode('live');
  assert.equal(getDashboardMode(), 'live');
};
