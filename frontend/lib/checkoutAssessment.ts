import {
  createAssessment,
  createStatementDocument,
  fetchExtractionJob,
  isFairlensApiError
} from '@/lib/fairlensApi';
import type { StatementTransactionInput } from '@/types';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const runCheckoutAssessment = async ({
  statementFile,
  isCsvStatementFile,
  parseCsvTransactions,
  total,
  emiDuration
}: {
  statementFile: File;
  isCsvStatementFile: (file: File) => boolean;
  parseCsvTransactions: (file: File) => Promise<StatementTransactionInput[]>;
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

