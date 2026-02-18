import assert from 'node:assert/strict';
import { fetchAuditLogs, fetchLogs, fetchStats, mapLogToEMIRequest, predictBNPLRisk } from '../../lib/fairlensApi';
import { BackendLogItem } from '../../types';

const baseLog: BackendLogItem = {
  id: 42,
  avg_monthly_inflow: 100000,
  inflow_volatility: 0.18,
  avg_monthly_outflow: 52000,
  min_balance_30d: 18000,
  neg_balance_days_30d: 1,
  purchase_to_inflow_ratio: 0.3,
  total_burden_ratio: 0.48,
  buffer_ratio: 0.19,
  stress_index: 0.36,
  risk_probability: 0.2,
  decision: 'Approve',
  created_at: '2026-02-16T12:20:00Z',
};

const withMockedFetch = async (mock: typeof fetch, fn: () => Promise<void>) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const run = async () => {
  {
    const result = mapLogToEMIRequest(baseLog);

    assert.equal(result.status, 'Approved');
    assert.equal(result.riskScore, 20);
    assert.equal(result.creditScore, 780);
    assert.equal(result.emiAmount, 5000);
    assert.equal(result.buyerId, 'BUY-00042');
    assert.equal(result.id, 'TXN-42');
  }

  {
    const declinedLog: BackendLogItem = {
      ...baseLog,
      id: 7,
      risk_probability: 0.85,
      decision: 'Decline',
    };

    const result = mapLogToEMIRequest(declinedLog);

    assert.equal(result.status, 'Rejected');
    assert.equal(result.riskScore, 85);
    assert.equal(result.creditScore, 553);
  }

  {
    const statsFixture = {
      total_predictions: 4,
      approval_rate: 0.5,
      decline_rate: 0.5,
      risk_score_distribution: { low: 1, medium: 2, high: 1 },
    };

    await withMockedFetch(async () => jsonResponse(statsFixture), async () => {
      const stats = await fetchStats('live');
      assert.deepEqual(stats, statsFixture);
    });
  }

  {
    await withMockedFetch(async () => new Response('', { status: 200 }), async () => {
      await assert.rejects(fetchStats('live'), /empty response/i);
    });
  }

  {
    await withMockedFetch(async () => new Response('not-json', { status: 200 }), async () => {
      await assert.rejects(fetchLogs(1, 10, 'live'), /invalid json/i);
    });
  }

  {
    await withMockedFetch(
      async () =>
        jsonResponse(
          {
            detail: 'Backend unavailable',
          },
          503
        ),
      async () => {
        await assert.rejects(fetchStats('live'), /Backend unavailable/);
      }
    );
  }

  {
    const payload = {
      avg_monthly_inflow: 100000,
      inflow_volatility: 0.2,
      avg_monthly_outflow: 60000,
      min_balance_30d: 20000,
      neg_balance_days_30d: 0,
      purchase_to_inflow_ratio: 0.25,
      total_burden_ratio: 0.45,
      buffer_ratio: 0.2,
      stress_index: 0.3,
    };

    await withMockedFetch(async () => new Response('', { status: 200 }), async () => {
      await assert.rejects(predictBNPLRisk(payload), /empty response/i);
    });
  }

  {
    const response = await fetchAuditLogs(1, 10, 'demo', { status: 'success' });
    assert.ok(response.total >= response.items.length);
    assert.ok(response.items.every((item) => item.status === 'success'));
  }

  {
    await withMockedFetch(async () => new Response('not-json', { status: 200 }), async () => {
      await assert.rejects(fetchAuditLogs(1, 5, 'live'), /invalid json/i);
    });
  }
};
