import { Hono } from 'hono';
import { optionalAuth } from '../auth';
import { failure, success } from '../http';
import type { AppEnv } from '../types';

type AssistantCategory = 'checkout' | 'auth' | 'emi' | 'dashboard' | 'security' | 'general';
type AssistantActionType = 'navigate' | 'retry' | 'contact' | 'none';

type AssistantAction = {
  label: string;
  action: AssistantActionType;
  target?: string;
};

type AssistantResponsePayload = {
  reply: string;
  category: AssistantCategory;
  suggested_actions: AssistantAction[];
  escalation: { email: string; phone: string };
  source: 'rule_based' | 'remote';
};

const routes = new Hono<AppEnv>();

const CONTACT = {
  email: 'support@fairlens.ai',
  phone: '+91 98000 12345',
};

const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

const asNonEmpty = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toLower = (value: unknown): string => asNonEmpty(value)?.toLowerCase() ?? '';

const hasAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

const detectCategory = (message: string, page: string): AssistantCategory => {
  const text = `${message} ${page}`.toLowerCase();
  if (hasAny(text, ['checkout', 'statement', 'bank statement', 'upload', 'document', 'assessment'])) {
    return 'checkout';
  }
  if (hasAny(text, ['emi', 'approval', 'approved', 'decline', 'rejected', 'risk'])) {
    return 'emi';
  }
  if (hasAny(text, ['login', 'signup', 'password', 'otp', 'auth', 'token', 'account'])) {
    return 'auth';
  }
  if (hasAny(text, ['dashboard', 'admin', 'audit', 'override', 'analytics'])) {
    return 'dashboard';
  }
  if (hasAny(text, ['secure', 'security', 'privacy', 'data'])) {
    return 'security';
  }
  return 'general';
};

const buildActions = (category: AssistantCategory, isAdmin: boolean): AssistantAction[] => {
  if (category === 'checkout') {
    return [
      { label: 'Open checkout', action: 'navigate', target: '/checkout' },
      { label: 'Retry eligibility check', action: 'retry' },
      { label: 'Contact support', action: 'contact' },
    ];
  }

  if (category === 'emi') {
    return [
      { label: 'Open EMI requests', action: 'navigate', target: isAdmin ? '/emi-requests' : '/orders' },
      { label: 'Retry with updated inputs', action: 'retry' },
      { label: 'Contact support', action: 'contact' },
    ];
  }

  if (category === 'auth') {
    return [
      { label: 'Open login', action: 'navigate', target: isAdmin ? '/admin/login' : '/login' },
      { label: 'Retry sign-in', action: 'retry' },
      { label: 'Contact support', action: 'contact' },
    ];
  }

  if (category === 'dashboard') {
    return [
      { label: 'Open dashboard', action: 'navigate', target: '/dashboard' },
      { label: 'Refresh data', action: 'retry' },
      { label: 'Contact support', action: 'contact' },
    ];
  }

  if (category === 'security') {
    return [
      { label: 'Open support', action: 'navigate', target: '/support' },
      { label: 'Contact support', action: 'contact' },
    ];
  }

  return [
    { label: 'Open support', action: 'navigate', target: '/support' },
    { label: 'Contact support', action: 'contact' },
  ];
};

const buildRuleReply = (category: AssistantCategory, isAdmin: boolean): string => {
  if (category === 'checkout') {
    return 'For EMI checks, upload a recent statement and verify monthly income/card details before retrying eligibility.';
  }
  if (category === 'emi') {
    return 'EMI decisions come from statement-based risk assessment. Retry with cleaner statement data or adjust tenure/amount.';
  }
  if (category === 'auth') {
    return isAdmin
      ? 'Use admin sign-in and ensure your account has admin role mapping in user_roles before retrying.'
      : 'Use user sign-in/signup, then retry the action after your session refreshes.';
  }
  if (category === 'dashboard') {
    return 'Dashboard routes are admin-protected. Confirm admin role assignment and refresh the page to reload latest decisions.';
  }
  if (category === 'security') {
    return 'FairLens stores decision metrics and audit logs; sensitive auth and role checks are enforced at API level.';
  }
  return 'I can help with checkout, EMI decisions, login issues, dashboard access, and support escalation.';
};

const isAssistantAction = (value: unknown): value is AssistantAction => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const label = asNonEmpty(candidate.label);
  const action = asNonEmpty(candidate.action);
  if (!label || !action) {
    return false;
  }
  if (!['navigate', 'retry', 'contact', 'none'].includes(action)) {
    return false;
  }
  return true;
};

const parseRemoteResponse = (payload: unknown): AssistantResponsePayload | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const maybeData = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  const reply = asNonEmpty(maybeData.reply);
  const category = asNonEmpty(maybeData.category) as AssistantCategory | null;
  const actionsRaw = maybeData.suggested_actions;

  if (!reply || !category || !['checkout', 'auth', 'emi', 'dashboard', 'security', 'general'].includes(category)) {
    return null;
  }

  const suggestedActions = Array.isArray(actionsRaw) ? actionsRaw.filter(isAssistantAction) : [];
  return {
    reply,
    category,
    suggested_actions: suggestedActions,
    escalation: CONTACT,
    source: 'remote',
  };
};

const parseJsonObjectFromText = (text: string): Record<string, unknown> | null => {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const direct = (() => {
    try {
      const parsed = JSON.parse(trimmed);
      return asRecord(parsed);
    } catch {
      return null;
    }
  })();
  if (direct) {
    return direct;
  }

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (withoutFence !== trimmed) {
    try {
      const parsed = JSON.parse(withoutFence);
      return asRecord(parsed);
    } catch {
      // Continue with brace extraction.
    }
  }

  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1));
    return asRecord(parsed);
  } catch {
    return null;
  }
};

const parseOpenRouterResponse = (payload: unknown): AssistantResponsePayload | null => {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const choices = Array.isArray(root.choices) ? root.choices : [];
  for (const choice of choices) {
    const choiceRecord = asRecord(choice);
    if (!choiceRecord) {
      continue;
    }

    const message = asRecord(choiceRecord.message);
    const content = asNonEmpty(message?.content);
    if (!content) {
      continue;
    }

    const parsed = parseJsonObjectFromText(content);
    if (!parsed) {
      continue;
    }
    const remote = parseRemoteResponse(parsed);
    if (remote) {
      return remote;
    }
  }

  return null;
};

const extractOpenRouterTextReply = (payload: unknown): string | null => {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const choices = Array.isArray(root.choices) ? root.choices : [];
  for (const choice of choices) {
    const choiceRecord = asRecord(choice);
    if (!choiceRecord) {
      continue;
    }
    const message = asRecord(choiceRecord.message);
    const content = asNonEmpty(message?.content);
    if (content) {
      return content;
    }
  }

  return null;
};

const sanitizeOpenRouterReply = (value: string): string =>
  value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const callOpenRouterModel = async (
  env: AppEnv['Bindings'],
  payload: Record<string, unknown>,
  model: string
): Promise<AssistantResponsePayload | null> => {
  const apiKey = asNonEmpty(env.OPENROUTER_API_KEY);
  if (!apiKey) {
    return null;
  }

  const endpoint = asNonEmpty(env.OPENROUTER_CHAT_COMPLETIONS_URL) ?? OPENROUTER_CHAT_COMPLETIONS_URL;
  const appUrl = asNonEmpty(env.OPENROUTER_SITE_URL);
  const appName = asNonEmpty(env.OPENROUTER_APP_NAME);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (appUrl) {
    headers['HTTP-Referer'] = appUrl;
  }
  if (appName) {
    headers['X-Title'] = appName;
  }

  const requestBody = {
    model,
    temperature: 0.2,
    max_tokens: 420,
    messages: [
      {
        role: 'system',
        content:
          'You are the FairLens app assistant. Give concise practical help in 1-2 sentences. If possible, return JSON with keys reply, category, suggested_actions. category should be one of checkout|auth|emi|dashboard|security|general. suggested_actions items should use action navigate|retry|contact|none.',
      },
      {
        role: 'user',
        content: JSON.stringify(payload),
      },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      return null;
    }

    const json = await response.json().catch(() => null);
    const context = asRecord(payload.context);
    const page = toLower(context?.page);
    const user = asRecord(payload.user);
    const roles = Array.isArray(user?.roles)
      ? user.roles.filter((role): role is string => typeof role === 'string')
      : [];
    const isAdmin =
      user?.is_admin === true || roles.some((role) => role.trim().toLowerCase() === 'admin');
    const prompt = asNonEmpty(payload.message) ?? '';

    const structured = parseOpenRouterResponse(json);
    if (structured) {
      if (structured.suggested_actions.length > 0) {
        return structured;
      }
      return {
        ...structured,
        suggested_actions: buildActions(structured.category, isAdmin),
      };
    }

    const textReply = extractOpenRouterTextReply(json);
    const reply = textReply ? sanitizeOpenRouterReply(textReply) : null;
    if (!reply) {
      return null;
    }

    const category = detectCategory(`${prompt} ${reply}`, page);

    return {
      reply: reply.slice(0, 700),
      category,
      suggested_actions: buildActions(category, isAdmin),
      escalation: CONTACT,
      source: 'remote',
    };
  } catch {
    return null;
  }
};

const resolveRemoteAssistant = async (
  env: AppEnv['Bindings'],
  payload: Record<string, unknown>
): Promise<AssistantResponsePayload | null> => {
  const openRouterPrimaryModel = asNonEmpty(env.OPENROUTER_PRIMARY_MODEL);
  if (openRouterPrimaryModel && asNonEmpty(env.OPENROUTER_API_KEY)) {
    const primary = await callOpenRouterModel(env, payload, openRouterPrimaryModel);
    if (primary) {
      return primary;
    }

    const openRouterFallbackModel = asNonEmpty(env.OPENROUTER_FALLBACK_MODEL);
    if (openRouterFallbackModel && openRouterFallbackModel !== openRouterPrimaryModel) {
      const fallback = await callOpenRouterModel(env, payload, openRouterFallbackModel);
      if (fallback) {
        return fallback;
      }
    }
  }

  const endpoint = asNonEmpty(env.AI_ASSISTANT_ENDPOINT);
  if (!endpoint) {
    return null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = asNonEmpty(env.AI_ASSISTANT_TOKEN);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return null;
    }
    const json = await response.json().catch(() => null);
    return parseRemoteResponse(json);
  } catch {
    return null;
  }
};

routes.post('/query', optionalAuth, async (c) => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return failure(c, { code: 'invalid_request', message: 'Invalid JSON body' }, 400);
  }

  const message = asNonEmpty(body.message);
  if (!message || message.length > 1000) {
    return failure(c, { code: 'invalid_request', message: 'message is required (1-1000 chars)' }, 400);
  }

  const context =
    body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? (body.context as Record<string, unknown>)
      : {};

  const page = toLower(context.page);
  const user = c.get('authUser');
  const isAdmin = user.roles.some((role) => role.trim().toLowerCase() === 'admin');

  const remotePayload = {
    message,
    context,
    user: {
      subject: user.subject,
      email: user.email,
      roles: user.roles,
      is_admin: isAdmin,
    },
  };

  const remote = await resolveRemoteAssistant(c.env, remotePayload);
  if (remote) {
    return success(c, remote, 200);
  }

  const category = detectCategory(message, page);
  const responsePayload: AssistantResponsePayload = {
    reply: buildRuleReply(category, isAdmin),
    category,
    suggested_actions: buildActions(category, isAdmin),
    escalation: CONTACT,
    source: 'rule_based',
  };
  return success(c, responsePayload, 200);
});

export default routes;
