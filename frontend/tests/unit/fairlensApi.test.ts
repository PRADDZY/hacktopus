import assert from 'node:assert/strict';
import {
  queryAssistant,
  createAssessment,
  createApplication,
  createStatementDocument,
  fetchExtractionJob,
  fetchAdminApplication,
  fetchAdminApplications,
  fetchAuditLogs,
  fetchLogs,
  fetchStats,
  mapLogToEMIRequest,
  overrideAdminApplication,
  predictBNPLRisk,
} from '../../lib/fairlensApi';
import { BackendApplicationItem, BackendLogItem } from '../../types';

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
    const applicationLog: BackendLogItem = {
      ...baseLog,
      application_uuid: '6b4f7f6a-39fd-4cf7-a8c7-0b9bce862f00',
      user_sub: 'auth0|abc123',
      order_amount_inr: 36000,
      tenure_months: 6,
      monthly_income_inr: 100000,
      bank: 'HDFC Bank',
      auto_decision: 'Decline',
      final_decision: 'Approve',
      decision_source: 'manual_override',
      reviewed_by: 'admin@fairlens.ai',
      override_reason: 'Manual underwriting approval',
      updated_at: '2026-03-20T09:00:00Z',
    };

    const result = mapLogToEMIRequest(applicationLog);
    assert.equal(result.applicationUuid, applicationLog.application_uuid);
    assert.equal(result.status, 'Approved');
    assert.equal(result.buyerId, 'auth0|abc123');
    assert.equal(result.decisionSource, 'manual_override');
    assert.equal(result.reviewedBy, 'admin@fairlens.ai');
  }

  {
    const statsFixture = {
      total_predictions: 4,
      approval_rate: 0.5,
      decline_rate: 0.5,
      risk_score_distribution: { low: 1, medium: 2, high: 1 },
    };

    await withMockedFetch(async () => jsonResponse(statsFixture), async () => {
      const stats = await fetchStats();
      assert.deepEqual(stats, statsFixture);
    });
  }

  {
    const statsFixture = {
      total_predictions: 8,
      approval_rate: 0.625,
      decline_rate: 0.375,
      risk_score_distribution: { low: 2, medium: 4, high: 2 },
    };

    await withMockedFetch(
      async () =>
        jsonResponse({
          data: statsFixture,
          error: null,
          meta: { requestId: 'req-1', timestamp: '2026-03-25T00:00:00.000Z' },
        }),
      async () => {
        const stats = await fetchStats();
        assert.deepEqual(stats, statsFixture);
      }
    );
  }

  {
    await withMockedFetch(async () => new Response('', { status: 200 }), async () => {
      await assert.rejects(fetchStats(), /empty response/i);
    });
  }

  {
    await withMockedFetch(async () => new Response('not-json', { status: 200 }), async () => {
      await assert.rejects(fetchLogs(1, 10), /invalid json/i);
    });
  }

  {
    const fixture: BackendApplicationItem = {
      ...baseLog,
      application_uuid: 'app-1',
      auto_decision: 'Approve',
      final_decision: 'Approve',
      decision_source: 'auto',
      updated_at: '2026-03-23T10:00:00Z',
    };

    await withMockedFetch(
      async () => jsonResponse({ page: 1, limit: 10, total: 1, total_pages: 1, items: [fixture] }),
      async () => {
        const data = await fetchAdminApplications(1, 10);
        assert.equal(data.items[0].application_uuid, 'app-1');
      }
    );
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
        await assert.rejects(fetchStats(), /Backend unavailable/);
      }
    );
  }

  {
    await withMockedFetch(
      async () =>
        jsonResponse(
          {
            error: {
              code: 'supabase_error',
              message: 'Service unavailable',
            },
            data: null,
          },
          503
        ),
      async () => {
        await assert.rejects(fetchStats(), /Service unavailable/);
      }
    );
  }

  {
    const payload = {
      segment: 'gig_worker',
      monthly_inflow: 100000,
      monthly_outflow: 60000,
      inflow_volatility_90d: 0.2,
      outflow_volatility_90d: 0.24,
      deposit_count_30d: 6,
      days_since_last_income: 2,
      avg_balance_30d: 22000,
      min_balance_30d: 20000,
      negative_balance_days_30d: 0,
      essential_spend_ratio: 0.61,
      active_loan_count: 1,
      monthly_installment_burden: 8500,
      purchase_amount: 30000,
      tenure_weeks: 24,
      purchase_to_inflow_ratio: 0.25,
      installment_to_inflow_ratio: 0.085,
      total_burden_ratio: 0.45,
      buffer_ratio: 0.2,
      stress_index: 0.3,
    };

    await withMockedFetch(async () => new Response('', { status: 200 }), async () => {
      await assert.rejects(predictBNPLRisk(payload), /empty response/i);
    });
  }

  {
    const createPayload = {
      order_amount_inr: 45000,
      tenure_months: 6,
      bank: 'HDFC Bank',
      monthly_income_inr: 90000,
      card_type: 'credit' as const,
      card_last_four: '1234',
    };
    const createdFixture: BackendApplicationItem = {
      ...baseLog,
      application_uuid: 'app-created',
      auto_decision: 'Approve',
      final_decision: 'Approve',
      decision_source: 'auto',
      updated_at: '2026-03-23T10:00:00Z',
    };

    await withMockedFetch(async () => jsonResponse(createdFixture), async () => {
      const created = await createApplication(createPayload);
      assert.equal(created.application_uuid, 'app-created');
    });
  }

  {
    const detailFixture: BackendApplicationItem = {
      ...baseLog,
      application_uuid: 'app-detail',
      auto_decision: 'Approve',
      final_decision: 'Approve',
      decision_source: 'auto',
      updated_at: '2026-03-23T10:00:00Z',
    };

    await withMockedFetch(async () => jsonResponse(detailFixture), async () => {
      const detail = await fetchAdminApplication('app-detail');
      assert.equal(detail.application_uuid, 'app-detail');
    });
  }

  {
    const overrideFixture: BackendApplicationItem = {
      ...baseLog,
      application_uuid: 'app-override',
      auto_decision: 'Decline',
      final_decision: 'Approve',
      decision_source: 'manual_override',
      override_reason: 'Manual review',
      updated_at: '2026-03-23T10:00:00Z',
    };

    await withMockedFetch(async () => jsonResponse(overrideFixture), async () => {
      const updated = await overrideAdminApplication('app-override', {
        decision: 'Approve',
        reason: 'Manual review',
      });
      assert.equal(updated.decision_source, 'manual_override');
      assert.equal(updated.final_decision, 'Approve');
    });
  }

  {
    const documentFixture = {
      id: 'doc-1',
      storage_key: 'uploads/a.csv',
      extraction_job_id: 'job-1',
      extraction_job_status: 'queued',
    };

    await withMockedFetch(
      async () =>
        jsonResponse({
          data: documentFixture,
          error: null,
          meta: { requestId: 'req-doc', timestamp: '2026-03-26T00:00:00.000Z' },
        }),
      async () => {
        const created = await createStatementDocument({
          storage_key: 'uploads/a.csv',
          file_name: 'a.csv',
          mime_type: 'text/csv',
          source: 'checkout',
        });
        assert.equal(created.id, 'doc-1');
        assert.equal(created.extraction_job_id, 'job-1');
      }
    );
  }

  {
    const extractionFixture = {
      id: 'job-1',
      document_id: 'doc-1',
      status: 'completed',
      document_status: 'ready',
    };

    await withMockedFetch(
      async () =>
        jsonResponse({
          data: extractionFixture,
          error: null,
          meta: { requestId: 'req-job', timestamp: '2026-03-26T00:00:00.000Z' },
        }),
      async () => {
        const job = await fetchExtractionJob('job-1');
        assert.equal(job.status, 'completed');
      }
    );
  }

  {
    const assessmentFixture = {
      id: 'asm-1',
      owner_sub: 'user-1',
      document_id: 'doc-1',
      risk_probability: 0.21,
      auto_decision: 'Approve',
      final_decision: 'Approve',
      decision_source: 'auto',
    };

    await withMockedFetch(
      async () =>
        jsonResponse({
          data: assessmentFixture,
          error: null,
          meta: { requestId: 'req-asm', timestamp: '2026-03-26T00:00:00.000Z' },
        }),
      async () => {
        const assessment = await createAssessment({
          document_id: 'doc-1',
          statement: {
            segment: 'gig_worker',
            statement_window_days: 90,
            purchase_amount: 25000,
            tenure_weeks: 24,
            transactions: [
              {
                booked_at: '2026-03-01T00:00:00.000Z',
                amount: 12000,
                balance: 21000,
                direction: 'credit',
              },
            ],
          },
        });
        assert.equal(assessment.id, 'asm-1');
        assert.equal(assessment.final_decision, 'Approve');
      }
    );
  }

  {
    await withMockedFetch(async () => new Response('not-json', { status: 200 }), async () => {
      await assert.rejects(fetchAuditLogs(1, 5), /invalid json/i);
    });
  }

  {
    const assistantFixture = {
      reply: 'Try uploading a CSV statement with at least 3 months of transactions.',
      category: 'checkout',
      suggested_actions: [{ label: 'Go to checkout', action: 'navigate', target: '/checkout' }],
      escalation: { email: 'support@fairlens.ai', phone: '+91 98000 12345' },
      source: 'rule_based',
    } as const;

    await withMockedFetch(
      async () =>
        jsonResponse({
          data: assistantFixture,
          error: null,
          meta: { requestId: 'req-assistant', timestamp: '2026-03-26T00:00:00.000Z' },
        }),
      async () => {
        const response = await queryAssistant({
          message: 'EMI not getting approved',
          context: { page: '/checkout' },
        });
        assert.equal(response.category, 'checkout');
        assert.equal(response.suggested_actions[0]?.target, '/checkout');
      }
    );
  }
};
