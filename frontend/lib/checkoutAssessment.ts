import {
  createAssessment,
  createStatementDocument,
  fetchExtractionJob,
  isFairlensApiError
} from '@/lib/fairlensApi';
import type { StatementTransactionInput } from '@/types';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseNumeric = (value: string): number | null => {
  const normalized = value.replace(/[^\d.-]/g, '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

export const parseCsvTransactions = async (file: File): Promise<StatementTransactionInput[]> => {
  const raw = await file.text();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  const findIndex = (candidates: string[]): number =>
    headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));

  const dateIndex = findIndex(['date', 'booked_at', 'txn_date']);
  const amountIndex = findIndex(['amount', 'txn_amount', 'value']);
  const balanceIndex = findIndex(['balance', 'closing_balance', 'running_balance']);
  const directionIndex = findIndex(['direction', 'type', 'drcr', 'crdr']);
  const debitIndex = findIndex(['debit', 'withdrawal']);
  const creditIndex = findIndex(['credit', 'deposit']);
  const descriptionIndex = findIndex(['description', 'narration', 'remark', 'details']);

  const output: StatementTransactionInput[] = [];
  let runningBalance = 0;

  for (const line of lines.slice(1, 401)) {
    const columns = line.split(',').map((column) => column.trim());
    const bookedAtRaw = dateIndex >= 0 ? columns[dateIndex] : '';
    const parsedDate = bookedAtRaw ? new Date(bookedAtRaw) : new Date();
    const bookedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    let amount: number | null = null;
    let direction: 'credit' | 'debit' | undefined;

    if (debitIndex >= 0 || creditIndex >= 0) {
      const debitValue = debitIndex >= 0 ? parseNumeric(columns[debitIndex] ?? '') : null;
      const creditValue = creditIndex >= 0 ? parseNumeric(columns[creditIndex] ?? '') : null;
      if (creditValue !== null && creditValue > 0) {
        amount = Math.abs(creditValue);
        direction = 'credit';
      } else if (debitValue !== null && debitValue > 0) {
        amount = Math.abs(debitValue);
        direction = 'debit';
      }
    }

    if (amount === null && amountIndex >= 0) {
      const parsedAmount = parseNumeric(columns[amountIndex] ?? '');
      if (parsedAmount !== null) {
        amount = Math.abs(parsedAmount);
        direction = parsedAmount < 0 ? 'debit' : 'credit';
      }
    }

    if (amount === null || amount <= 0) {
      continue;
    }

    if (directionIndex >= 0) {
      const rawDirection = (columns[directionIndex] ?? '').toLowerCase();
      if (['debit', 'dr', 'withdrawal'].some((entry) => rawDirection.includes(entry))) {
        direction = 'debit';
      } else if (['credit', 'cr', 'deposit'].some((entry) => rawDirection.includes(entry))) {
        direction = 'credit';
      }
    }

    direction = direction ?? 'debit';

    let balance = balanceIndex >= 0 ? parseNumeric(columns[balanceIndex] ?? '') : null;
    if (balance === null) {
      runningBalance = direction === 'credit' ? runningBalance + amount : runningBalance - amount;
      balance = runningBalance;
    } else {
      runningBalance = balance;
    }

    const description = descriptionIndex >= 0 ? columns[descriptionIndex] || undefined : undefined;
    output.push({
      booked_at: bookedAt,
      amount: Number(amount.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      direction,
      description
    });
  }

  return output;
};

export const isCsvStatementFile = (file: File): boolean =>
  file.type.includes('csv') || file.name.toLowerCase().endsWith('.csv');

export const runCheckoutAssessment = async ({
  statementFile,
  total,
  emiDuration
}: {
  statementFile: File;
  total: number;
  emiDuration: number;
}): Promise<{
  assessmentId: string;
  decision: 'Approve' | 'Decline';
  riskProbability: number;
  decisionSource: 'auto' | 'manual_override';
}> => {
  const document = await createStatementDocument({
    storage_key: `uploads/${Date.now()}-${statementFile?.name ?? 'statement-upload'}`,
    file_name: statementFile?.name,
    mime_type: statementFile?.type,
    source: 'checkout'
  });

  const csvUpload = isCsvStatementFile(statementFile);
  let extractionStatus: 'queued' | 'processing' | 'completed' | 'failed' | null = null;

  if (document.extraction_job_id) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await fetchExtractionJob(document.extraction_job_id);
      extractionStatus = job.status;
      if (job.status === 'completed' || job.status === 'failed') {
        break;
      }
      await pause(900);
    }
  }

  if (extractionStatus === 'failed') {
    throw new Error('Statement extraction failed. Upload a clean statement or try CSV.');
  }
  if (!csvUpload && document.extraction_job_id && extractionStatus !== 'completed') {
    throw new Error('Statement extraction is still running. Please retry in a few seconds.');
  }
  if (!csvUpload && !document.extraction_job_id) {
    throw new Error('Non-CSV statements require extraction support. Upload CSV or enable extraction.');
  }

  const assessmentPayload: {
    document_id: string;
    statement?: {
      segment: string;
      statement_window_days: number;
      purchase_amount: number;
      tenure_weeks: number;
      transactions: StatementTransactionInput[];
    };
  } = {
    document_id: document.id
  };

  if (csvUpload) {
    const transactions = await parseCsvTransactions(statementFile);
    if (transactions.length < 12) {
      throw new Error('CSV parsing produced insufficient transactions. Upload a richer statement export.');
    }
    assessmentPayload.statement = {
      segment: 'gig_worker',
      statement_window_days: 90,
      purchase_amount: total,
      tenure_weeks: emiDuration * 4,
      transactions
    };
  }

  const assessment = await createAssessment(assessmentPayload);
  return {
    assessmentId: assessment.id,
    decision: assessment.final_decision,
    riskProbability: assessment.risk_probability,
    decisionSource: assessment.decision_source
  };
};

export const toCheckoutErrorMessage = (error: unknown): string => {
  if (isFairlensApiError(error)) {
    if (error.code === 'model_unavailable') {
      return 'Risk engine is temporarily unavailable. Please retry in a minute.';
    }
    if (error.code === 'idempotency_in_progress') {
      return 'This request is still processing. Please wait a few seconds and retry.';
    }
    if (error.status >= 500) {
      return 'Service is temporarily unavailable. Please retry shortly.';
    }
  }

  return error instanceof Error ? error.message : 'Unable to complete EMI risk assessment';
};
