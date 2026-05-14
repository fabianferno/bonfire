'use client';

/**
 * Multi-step "Create Agent" modal that mints a BonFire INFT via the user's
 * Privy embedded wallet on 0G testnet.
 *
 * Flow:
 *   1. User fills the form and submits.
 *   2. `POST /v1/agents/mint` — backend encrypts, uploads to 0G Storage, and
 *      returns `{mintPayload, reservationId, contractAddress}`.
 *   3. Privy `sendTransaction` — user signs; we get `txHash`.
 *   4. `POST /v1/agents/mint/confirm` — backend verifies on-chain, writes AgentDoc.
 *   5. Success state shown briefly, then modal closes.
 */

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useMintAgent } from '@/lib/inft';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';
import type { BackendAgent } from '@/lib/types';
import Modal, { ModalLabel, ModalInput, ModalTextarea } from '@/components/shared/Modal';
import { MintProgress, type MintStep } from './MintProgress';
import type { MintPayload } from '@/lib/inft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void;
  /** Called with the newly created agent after the modal closes. */
  onCreated?: (agent: BackendAgent) => void;
}

type WizardStep = 'form' | MintStep;

interface FormFields {
  slug: string;
  name: string;
  description: string;
  avatarUrl: string;
  tags: string;
  visibility: 'public' | 'unlisted';
  soul: string;
  agents: string;
  llmProvider: 'openai-compatible' | 'zerog';
  llmModel: string;
  llmTemperature: string;
  llmMaxTokens: string;
  mode: 0 | 1;
}

interface FieldErrors {
  slug?: string;
  name?: string;
  description?: string;
  avatarUrl?: string;
  soul?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9_-]{3,32}$/;

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateAgentModal({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const { mint } = useMintAgent();

  const [step, setStep] = useState<WizardStep>('form');
  const [mintError, setMintError] = useState<string | null>(null);

  const [fields, setFields] = useState<FormFields>({
    slug: '',
    name: '',
    description: '',
    avatarUrl: '',
    tags: '',
    visibility: 'public',
    soul: '',
    agents: '',
    llmProvider: 'openai-compatible',
    llmModel: '',
    llmTemperature: '0.7',
    llmMaxTokens: '1024',
    mode: 0,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Generic field updater that also clears the field-level error on change.
  const set =
    (key: keyof FormFields) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      if (key in fieldErrors) {
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    };

  // ------------------------------------------------------------------
  // Mint submit handler
  // ------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMintError(null);

    const errs = validate(fields);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    if (!user?.walletAddress) {
      // Wallet banner handles this — just guard here.
      return;
    }

    setSubmitting(true);
    try {
      // ---- Step 1: backend prepares manifests + encrypted bundle ----
      setStep('preparing');

      const tags = fields.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const llmTemp = parseFloat(fields.llmTemperature);
      const llmMax = parseInt(fields.llmMaxTokens, 10);

      const prepareBody = {
        slug: fields.slug,
        name: fields.name.trim(),
        description: fields.description.trim(),
        avatarUrl: fields.avatarUrl.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        visibility: fields.visibility,
        soul: fields.soul.trim(),
        agents: fields.agents.trim() || undefined,
        llm: {
          provider: fields.llmProvider,
          model: fields.llmModel.trim() || undefined,
          temperature: Number.isFinite(llmTemp) ? llmTemp : 0.7,
          maxTokens: Number.isFinite(llmMax) ? llmMax : 1024,
        },
        // Backend expects the string label; converts to the on-chain uint8 internally.
        mode: fields.mode === 0 ? 'public' : 'permissioned',
      };

      // POST /v1/agents/mint — backend encrypts, uploads to 0G Storage, returns
      // the parameters the frontend must pass to the smart contract.
      const prepareResult = await api<{
        mintPayload: MintPayload;
        reservationId: string;
        contractAddress: string;
      }>('POST', '/v1/agents/mint', prepareBody);

      const { mintPayload, reservationId, contractAddress } = prepareResult;

      // ---- Step 2: user signs the mint transaction via Privy ----
      setStep('signing');

      let txHash: `0x${string}`;
      try {
        const result = await mint({ payload: mintPayload, contractAddress });
        txHash = result.txHash;
      } catch (signingErr: unknown) {
        // Distinguish user-rejection from unexpected errors so we can show a
        // helpful "you rejected" message rather than a generic failure.
        const msg =
          signingErr instanceof Error ? signingErr.message : String(signingErr);
        const isRejection =
          /rejected|denied|cancel/i.test(msg) ||
          (signingErr as { code?: number })?.code === 4001;

        setMintError(
          isRejection ? 'You rejected the transaction. Retry?' : msg,
        );
        setStep('error');
        setSubmitting(false);
        return;
      }

      // ---- Step 3: backend verifies receipt and creates AgentDoc ----
      setStep('confirming');

      const confirmResult = await api<{ agent: BackendAgent }>(
        'POST',
        '/v1/agents/mint/confirm',
        { txHash, reservationId },
      );

      setStep('done');
      onCreated?.(confirmResult.agent);
      setTimeout(onClose, 1400);
    } catch (err: unknown) {
      let msg = 'Mint failed. Please try again.';
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Slug conflict — surface inline on the slug field and return to form.
          setFieldErrors((prev) => ({
            ...prev,
            slug: 'That slug is already taken in the marketplace.',
          }));
          setStep('form');
          setSubmitting(false);
          return;
        }
        msg = err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setMintError(msg);
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  };

  // Allow retrying after an error by going back to the form.
  const handleRetry = () => {
    setMintError(null);
    setStep('form');
  };

  // ------------------------------------------------------------------
  // Wallet-not-ready banner
  // ------------------------------------------------------------------
  const walletMissing = !user?.walletAddress;

  // ------------------------------------------------------------------
  // Render: non-form steps
  // ------------------------------------------------------------------
  if (step !== 'form') {
    return (
      <Modal title="Create Agent" onClose={onClose} wide maxHeight="80vh">
        <MintProgress step={step as MintStep} error={mintError} />
        {step === 'error' && (
          <div className="flex justify-end mt-4">
            <button
              onClick={handleRetry}
              className="px-5 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
            >
              Back to form
            </button>
          </div>
        )}
      </Modal>
    );
  }

  // ------------------------------------------------------------------
  // Render: form
  // ------------------------------------------------------------------
  return (
    <Modal title="Create Agent" onClose={onClose} wide maxHeight="80vh">
      {/* Wallet-not-ready banner */}
      {walletMissing && (
        <div
          className="rounded p-3 text-sm mb-2"
          style={{
            background: 'rgba(251,191,36,0.12)',
            border: '1px solid rgba(251,191,36,0.4)',
            color: '#fbbf24',
          }}
        >
          Your wallet isn&apos;t ready yet. Click Privy&apos;s account button to
          provision an embedded wallet, then retry.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Two-column identity fields ───────────────────────────── */}
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
              Comma-separated (e.g. research, code, writing)
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
                    onChange={() => setFields((prev) => ({ ...prev, visibility: v }))}
                    className="accent-[var(--bf-fire)]"
                  />
                  <span className="text-sm capitalize text-white">{v}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Mode (Public / Permissioned) */}
          <div>
            <ModalLabel>Invocation mode</ModalLabel>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="0"
                  checked={fields.mode === 0}
                  onChange={() => setFields((prev) => ({ ...prev, mode: 0 }))}
                  className="accent-[var(--bf-fire)]"
                />
                <div>
                  <span className="text-sm text-white">Public</span>
                  <p className="text-xs" style={{ color: 'var(--bf-gray)' }}>
                    Anyone can invoke
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="1"
                  checked={fields.mode === 1}
                  onChange={() => setFields((prev) => ({ ...prev, mode: 1 }))}
                  className="accent-[var(--bf-fire)]"
                />
                <div>
                  <span className="text-sm text-white">Permissioned</span>
                  <p className="text-xs" style={{ color: 'var(--bf-gray)' }}>
                    You authorize each server
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* ── SOUL ───────────────────────────────────────────────────── */}
        <div>
          <ModalLabel>
            SOUL <span style={{ color: 'var(--bf-fire)' }}>*</span>
          </ModalLabel>
          <ModalTextarea
            rows={10}
            value={fields.soul}
            onChange={set('soul')}
            placeholder={
              'You are an expert research assistant called Ember.\n' +
              'You speak concisely and cite sources when possible.\n' +
              'You never make up facts — if unsure, say so.\n' +
              '\n' +
              'Tip: write in second person ("You are…"). The more specific,\n' +
              'the more consistent the agent behaves.'
            }
          />
          {fieldErrors.soul && (
            <p className="text-rose-300 bg-rose-900/40 rounded p-2 text-sm mt-1">
              {fieldErrors.soul}
            </p>
          )}
        </div>

        {/* ── AGENTS / Operating rules ─────────────────────────────── */}
        <div>
          <ModalLabel>AGENTS (operating rules)</ModalLabel>
          <ModalTextarea
            rows={6}
            value={fields.agents}
            onChange={set('agents')}
            placeholder={
              'Operating rules:\n' +
              '- Always confirm before running destructive commands.\n' +
              "- Don't mention other agents unless explicitly asked.\n" +
              '- Respond in the same language the user writes in.'
            }
          />
          <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
            Hard constraints your agent must always follow.
          </p>
        </div>

        {/* ── LLM settings ─────────────────────────────────────────── */}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--bf-gray)' }}
          >
            LLM settings
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Provider */}
            <div>
              <ModalLabel>Provider</ModalLabel>
              <select
                value={fields.llmProvider}
                onChange={set('llmProvider')}
                className="w-full rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--bf-accent)]"
                style={{ background: 'var(--bf-quaternary)', border: '1px solid transparent' }}
              >
                <option value="openai-compatible">OpenAI-compatible</option>
                <option value="zerog">0G Compute</option>
              </select>
            </div>

            {/* Model */}
            <div>
              <ModalLabel>Model</ModalLabel>
              <ModalInput
                type="text"
                value={fields.llmModel}
                onChange={set('llmModel')}
                placeholder={
                  fields.llmProvider === 'zerog' ? 'auto (broker selects)' : 'gpt-4o-mini'
                }
                autoComplete="off"
              />
            </div>

            {/* Temperature */}
            <div>
              <ModalLabel>Temperature</ModalLabel>
              <ModalInput
                type="number"
                value={fields.llmTemperature}
                onChange={set('llmTemperature')}
                min={0}
                max={2}
                step={0.1}
                placeholder="0.7"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
                0 = deterministic · 2 = very creative
              </p>
            </div>

            {/* Max tokens */}
            <div>
              <ModalLabel>Max tokens</ModalLabel>
              <ModalInput
                type="number"
                value={fields.llmMaxTokens}
                onChange={set('llmMaxTokens')}
                min={64}
                max={32768}
                step={64}
                placeholder="1024"
              />
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────── */}
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
            disabled={submitting || walletMissing}
            className="px-5 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-default"
            style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
          >
            {submitting ? 'Minting…' : 'Mint Agent'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
