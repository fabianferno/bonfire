'use client';
import { useState } from 'react';
import { bf } from '@/lib/api-bonfire';
import { ApiError } from '@/lib/api';
import { AGENT_BASE_URL } from '@/lib/config';
import type { BackendAgent } from '@/lib/types';
import Modal, { ModalLabel, ModalInput, ModalTextarea } from '@/components/shared/Modal';

interface Props {
  onClose: () => void;
  /** Called when creation succeeds, after the modal closes. */
  onCreated: () => void;
}

type Step = 'form' | 'success';

interface FormFields {
  slug: string;
  name: string;
  description: string;
  avatarUrl: string;
  tags: string;
  visibility: 'public' | 'unlisted';
  soul: string;
  agents: string;
}

interface FieldErrors {
  slug?: string;
  name?: string;
  description?: string;
  avatarUrl?: string;
  soul?: string;
  envRows?: string;
  llm?: string;
}

interface EnvRow {
  key: string;
  value: string;
}

interface LlmState {
  provider?: 'openai-compatible' | 'zerog';
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string;
  temperature?: string;
  maxTokens?: string;
}

const SLUG_RE = /^[a-z0-9_-]{3,32}$/;
const ENV_KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

/** Returns true if the given string is a syntactically valid URL. */
function isValidUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

function validate(f: FormFields): FieldErrors {
  const errs: FieldErrors = {};

  if (!SLUG_RE.test(f.slug)) {
    errs.slug =
      'Slug must be 3–32 characters: lowercase letters, numbers, dashes, or underscores.';
  }
  if (!f.name.trim() || f.name.length > 64) {
    errs.name = 'Name is required and must be under 64 characters.';
  }
  if (!f.description.trim() || f.description.length > 200) {
    errs.description = 'Description is required and must be under 200 characters.';
  }
  if (f.avatarUrl.trim() && !isValidUrl(f.avatarUrl.trim())) {
    errs.avatarUrl = 'Must be a valid URL (e.g. https://…)';
  }
  if (!f.soul.trim()) {
    errs.soul = "SOUL is required — describe the agent's personality.";
  }

  return errs;
}

function buildEnvObject(rows: EnvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.key.trim() && r.value !== undefined) {
      out[r.key.trim()] = r.value;
    }
  }
  return out;
}

function buildLlmObject(s: LlmState): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (s.provider) out.provider = s.provider;
  if (s.baseUrl) out.baseUrl = s.baseUrl;
  if (s.model) out.model = s.model;
  if (s.apiKeyEnv) out.apiKeyEnv = s.apiKeyEnv;
  if (s.temperature !== undefined && s.temperature !== '') {
    const n = Number(s.temperature);
    if (!Number.isNaN(n)) out.temperature = n;
  }
  if (s.maxTokens !== undefined && s.maxTokens !== '') {
    const n = parseInt(s.maxTokens, 10);
    if (!Number.isNaN(n) && n > 0) out.maxTokens = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function validateEnvRows(rows: EnvRow[]): string | undefined {
  for (const r of rows) {
    if (!r.key.trim() && r.value.trim()) {
      return 'Each env var row with a value must also have a key.';
    }
  }
  return undefined;
}

function validateLlmState(s: LlmState): string | undefined {
  if (s.baseUrl && !isValidUrl(s.baseUrl)) {
    return 'LLM Base URL must be a valid URL.';
  }
  if (s.temperature !== undefined && s.temperature !== '') {
    const n = Number(s.temperature);
    if (Number.isNaN(n) || n < 0 || n > 2) {
      return 'Temperature must be a number between 0 and 2.';
    }
  }
  if (s.maxTokens !== undefined && s.maxTokens !== '') {
    const n = parseInt(s.maxTokens, 10);
    if (Number.isNaN(n) || n <= 0) {
      return 'Max Tokens must be a positive integer.';
    }
  }
  return undefined;
}

export default function CreateAgentModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [fields, setFields] = useState<FormFields>({
    slug: '',
    name: '',
    description: '',
    avatarUrl: '',
    tags: '',
    visibility: 'public',
    soul: '',
    agents: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ agent: BackendAgent; agentKey: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  // Env vars state
  const [envRows, setEnvRows] = useState<EnvRow[]>([{ key: '', value: '' }]);

  // LLM config state
  const [llm, setLlm] = useState<LlmState>({});
  const [showLlm, setShowLlm] = useState(false);

  const set = (key: keyof FormFields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFields((prev) => ({ ...prev, [key]: e.target.value }));
    // Clear field-level error on change
    if (fieldErrors[key as keyof FieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const addEnvRow = () => setEnvRows((prev) => [...prev, { key: '', value: '' }]);

  const removeEnvRow = (idx: number) =>
    setEnvRows((prev) => prev.filter((_, i) => i !== idx));

  const updateEnvRow = (idx: number, field: 'key' | 'value', val: string) => {
    setEnvRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    );
    if (fieldErrors.envRows) {
      setFieldErrors((prev) => ({ ...prev, envRows: undefined }));
    }
  };

  const setLlmField = (key: keyof LlmState, val: string | undefined) => {
    setLlm((prev) => ({ ...prev, [key]: val }));
    if (fieldErrors.llm) {
      setFieldErrors((prev) => ({ ...prev, llm: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errs = validate(fields);

    // Validate env rows
    const envErr = validateEnvRows(envRows);
    if (envErr) errs.envRows = envErr;

    // Warn on non-standard env keys (console only, don't block)
    for (const r of envRows) {
      if (r.key.trim() && !ENV_KEY_RE.test(r.key.trim())) {
        console.warn(
          `Env key "${r.key}" does not match convention [A-Z_][A-Z0-9_]* — submitted anyway.`,
        );
      }
    }

    // Validate LLM fields
    const llmErr = validateLlmState(llm);
    if (llmErr) errs.llm = llmErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const tags = fields.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const env = buildEnvObject(envRows);
      const llmObj = buildLlmObject(llm);

      const body: Record<string, unknown> = {
        slug: fields.slug,
        name: fields.name.trim(),
        description: fields.description.trim(),
        baseUrl: AGENT_BASE_URL,
        soul: fields.soul.trim() || undefined,
        agents: fields.agents.trim() || undefined,
        avatarUrl: fields.avatarUrl.trim() || null,
        visibility: fields.visibility,
        ...(tags.length > 0 && { tags }),
        ...(Object.keys(env).length > 0 && { env }),
        ...(llmObj && { llm: llmObj }),
      };

      const data = await bf.createAgent(body as Parameters<typeof bf.createAgent>[0]);

      setResult(data);
      setStep('success');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('That slug is already taken in the marketplace.');
        } else if (err.status === 502) {
          setError(
            'Agent server unreachable. Is the ember-agent running on port 7777?',
          );
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.agentKey) return;
    try {
      await navigator.clipboard.writeText(result.agentKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onCreated();
    } else {
      onClose();
    }
  };

  if (step === 'success' && result) {
    return (
      <Modal title="Agent Created" onClose={handleClose} wide maxHeight="80vh">
        <div className="flex flex-col gap-5">
          {/* Success heading */}
          <p className="text-lg font-semibold text-emerald-300">
            ✓ Created @{result.agent.slug}
          </p>

          {/* Agent key display */}
          <div>
            <p className="text-sm mb-2" style={{ color: 'var(--bf-gray)' }}>
              Your agent key (save this — it won&apos;t be shown again):
            </p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 block rounded px-3 py-2.5 text-sm font-mono break-all"
                style={{
                  background: 'var(--bf-tertiary)',
                  color: 'var(--bf-white)',
                  border: '1px solid var(--bf-quinary)',
                }}
              >
                {result.agentKey}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-3 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Next steps */}
          <div>
            <p className="text-sm font-semibold text-white mb-1">Next steps:</p>
            <ul className="list-disc list-inside text-sm space-y-1" style={{ color: 'var(--bf-gray)' }}>
              <li>
                Invite <span className="text-white">@{result.agent.slug}</span> to one of
                your servers
              </li>
              <li>
                Test it by @-mentioning in a channel
              </li>
            </ul>
          </div>

          {/* Done button */}
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create Agent" onClose={onClose} wide maxHeight="80vh">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Slug */}
          <div>
            <ModalLabel>
              Slug <span style={{ color: 'var(--bf-fire)' }}>*</span>
            </ModalLabel>
            <ModalInput
              type="text"
              value={fields.slug}
              onChange={set('slug')}
              placeholder="my-agent"
              pattern="[a-z0-9_\-]{3,32}"
              autoComplete="off"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
              Used as @handle in mentions
            </p>
            {fieldErrors.slug && (
              <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-1">
                {fieldErrors.slug}
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <ModalLabel>
              Name <span style={{ color: 'var(--bf-fire)' }}>*</span>
            </ModalLabel>
            <ModalInput
              type="text"
              value={fields.name}
              onChange={set('name')}
              placeholder="My Agent"
              maxLength={64}
              autoComplete="off"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
              Display name in the marketplace
            </p>
            {fieldErrors.name && (
              <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-1">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <ModalLabel>
              Description <span style={{ color: 'var(--bf-fire)' }}>*</span>
            </ModalLabel>
            <ModalInput
              type="text"
              value={fields.description}
              onChange={set('description')}
              placeholder="A one-line summary of what this agent does."
              maxLength={200}
              autoComplete="off"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
              One-line summary shown on marketplace cards
            </p>
            {fieldErrors.description && (
              <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-1">
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* Avatar URL */}
          <div>
            <ModalLabel>Avatar URL</ModalLabel>
            <ModalInput
              type="url"
              value={fields.avatarUrl}
              onChange={set('avatarUrl')}
              placeholder="https://example.com/avatar.png"
              autoComplete="off"
            />
            {fieldErrors.avatarUrl && (
              <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-1">
                {fieldErrors.avatarUrl}
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <ModalLabel>Tags</ModalLabel>
            <ModalInput
              type="text"
              value={fields.tags}
              onChange={set('tags')}
              placeholder="research, code, writing"
              autoComplete="off"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
              e.g. research, code, writing
            </p>
          </div>

          {/* Visibility */}
          <div>
            <ModalLabel>Visibility</ModalLabel>
            <div className="flex gap-4 mt-1">
              {(['public', 'unlisted'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={fields.visibility === v}
                    onChange={() =>
                      setFields((prev) => ({ ...prev, visibility: v }))
                    }
                    className="accent-[var(--bf-fire)]"
                  />
                  <span className="text-sm capitalize text-white">{v}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* SOUL */}
        <div>
          <ModalLabel>
            SOUL <span style={{ color: 'var(--bf-fire)' }}>*</span>
          </ModalLabel>
          <ModalTextarea
            rows={8}
            value={fields.soul}
            onChange={set('soul')}
            placeholder={"You are X. You speak like…"}
          />
          {fieldErrors.soul && (
            <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-1">
              {fieldErrors.soul}
            </p>
          )}
        </div>

        {/* AGENTS / Operating rules */}
        <div>
          <ModalLabel>AGENTS (operating rules)</ModalLabel>
          <ModalTextarea
            rows={5}
            value={fields.agents}
            onChange={set('agents')}
            placeholder={"Operating rules:\n- Confirm before destructive actions.\n- Don't mention other agents unless asked."}
          />
        </div>

        {/* ── Environment Variables ── */}
        <div>
          <p className="text-white font-semibold mb-1">Environment Variables (optional)</p>
          <p className="text-xs mb-1" style={{ color: 'var(--bf-symbol)' }}>
            Override env vars used at LLM build time and elsewhere. Keys must match what
            the agent reads (e.g. LLM_API_KEY, OG_BROKER_PROVIDER). Stored in plain
            JSON — don&apos;t put production secrets here.
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--bf-symbol)' }}>
            Keys like LLM_API_KEY are used by the agent&apos;s LLM client when building
            this tenant&apos;s model. Other keys can be read by skills or tools.
          </p>

          <div className="flex flex-col gap-2">
            {envRows.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateEnvRow(idx, 'key', e.target.value.toUpperCase())}
                  placeholder="KEY"
                  className="flex-1 text-sm rounded p-2 font-mono uppercase"
                  style={{
                    background: 'var(--bf-tertiary)',
                    color: 'var(--bf-white)',
                    minWidth: 0,
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateEnvRow(idx, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 text-sm rounded p-2"
                  style={{
                    background: 'var(--bf-tertiary)',
                    color: 'var(--bf-white)',
                    minWidth: 0,
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => removeEnvRow(idx)}
                  className="flex-shrink-0 px-2 py-1 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ color: '#f87171', background: 'rgba(248,113,113,0.12)' }}
                  aria-label="Remove row"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addEnvRow}
            className="mt-2 px-3 py-1 rounded text-sm transition-opacity hover:opacity-80"
            style={{
              color: 'var(--bf-white)',
              border: '1px solid var(--bf-quinary)',
              background: 'transparent',
            }}
          >
            + Add row
          </button>

          {fieldErrors.envRows && (
            <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-2">
              {fieldErrors.envRows}
            </p>
          )}
        </div>

        {/* ── LLM Configuration (collapsible) ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowLlm((v) => !v)}
            className="flex items-center gap-2 text-white font-semibold mb-1 hover:opacity-80 transition-opacity"
          >
            <span
              style={{
                display: 'inline-block',
                transform: showLlm ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                fontSize: '0.75rem',
              }}
            >
              ▶
            </span>
            LLM Configuration (advanced, optional)
          </button>

          {showLlm && (
            <div className="flex flex-col gap-3 mt-2">
              <p className="text-xs" style={{ color: 'var(--bf-symbol)' }}>
                Override the agent&apos;s default LLM for this tenant. Leave blank to use
                the agent&apos;s boot-time config.
              </p>

              {/* Provider */}
              <div>
                <ModalLabel>Provider</ModalLabel>
                <div className="flex gap-4 mt-1">
                  {(['openai-compatible', 'zerog', ''] as const).map((v) => (
                    <label key={v || 'default'} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="llm-provider"
                        value={v}
                        checked={(llm.provider ?? '') === v}
                        onChange={() =>
                          setLlmField(
                            'provider',
                            v === '' ? undefined : (v as 'openai-compatible' | 'zerog'),
                          )
                        }
                        className="accent-[var(--bf-fire)]"
                      />
                      <span className="text-sm text-white">
                        {v === '' ? '(unspecified)' : v}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Base URL + Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <ModalLabel>Base URL</ModalLabel>
                  <ModalInput
                    type="url"
                    value={llm.baseUrl ?? ''}
                    onChange={(e) => setLlmField('baseUrl', e.target.value || undefined)}
                    placeholder="https://api.openai.com/v1"
                    autoComplete="off"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
                    Only relevant for openai-compatible
                  </p>
                </div>
                <div>
                  <ModalLabel>Model</ModalLabel>
                  <ModalInput
                    type="text"
                    value={llm.model ?? ''}
                    onChange={(e) => setLlmField('model', e.target.value || undefined)}
                    placeholder="gpt-4o-mini"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* API Key Env + Temperature + Max Tokens */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <ModalLabel>API Key Env Variable Name</ModalLabel>
                  <ModalInput
                    type="text"
                    value={llm.apiKeyEnv ?? ''}
                    onChange={(e) => setLlmField('apiKeyEnv', e.target.value || undefined)}
                    placeholder="LLM_API_KEY"
                    autoComplete="off"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
                    Set the actual key above in Environment Variables
                  </p>
                </div>
                <div>
                  <ModalLabel>Temperature</ModalLabel>
                  <ModalInput
                    type="number"
                    value={llm.temperature ?? ''}
                    onChange={(e) => setLlmField('temperature', e.target.value || undefined)}
                    placeholder="0.7"
                    step={0.1}
                    min={0}
                    max={2}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <ModalLabel>Max Tokens</ModalLabel>
                  <ModalInput
                    type="number"
                    value={llm.maxTokens ?? ''}
                    onChange={(e) => setLlmField('maxTokens', e.target.value || undefined)}
                    placeholder="4096"
                    step={1}
                    min={1}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          )}

          {fieldErrors.llm && (
            <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-2">
              {fieldErrors.llm}
            </p>
          )}
        </div>

        {/* Global error */}
        {error && (
          <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm">{error}</p>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-white text-sm rounded hover:underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-default"
            style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
          >
            {submitting ? 'Creating…' : 'Create Agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
