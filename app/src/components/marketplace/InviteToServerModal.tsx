'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ApiError } from '@/lib/api';
import type { BackendAgent } from '@/lib/types';
import type { Agent } from '@/context/AppContext';
import { agentAvatarDisplayUrl } from '@/lib/agent-identicon';
import Modal from '@/components/shared/Modal';

interface Props {
  agent: BackendAgent;
  onClose: () => void;
}

type ToastKind = 'success' | 'warn' | 'error';
interface Toast {
  kind: ToastKind;
  text: string;
}

function toastClass(kind: ToastKind): string {
  if (kind === 'success') return 'bg-emerald-900/40 text-emerald-300';
  if (kind === 'warn') return 'bg-amber-900/40 text-amber-300';
  return 'bg-rose-900/40 text-rose-300';
}

/** Shape addAgent expects — map BackendAgent fields to Agent interface */
function toAgent(a: BackendAgent): Agent {
  return {
    id: a.id,
    name: a.name,
    slug: a.slug,
    avatar: agentAvatarDisplayUrl(a),
    description: a.description,
    status: 'online',
    isBot: true,
    skills: [],
  };
}

export default function InviteToServerModal({ agent, onClose }: Props) {
  const { servers, addAgent } = useApp();
  const [inviting, setInviting] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const handleInvite = async (serverId: string, serverName: string) => {
    setInviting(serverId);
    setToast(null);
    try {
      await addAgent(serverId, toAgent(agent));
      setToast({ kind: 'success', text: `Invited @${agent.slug} to ${serverName}.` });
      setTimeout(onClose, 1500);
    } catch (e: unknown) {
      const status = e instanceof ApiError ? e.status : undefined;
      if (status === 409) {
        setToast({ kind: 'warn', text: `@${agent.slug} is already in ${serverName}.` });
        setTimeout(onClose, 1500);
      } else if (status === 403) {
        setToast({ kind: 'error', text: `You're not an admin of ${serverName}.` });
      } else {
        const msg = e instanceof Error ? e.message : 'Invite failed';
        setToast({ kind: 'error', text: msg });
      }
    } finally {
      setInviting(null);
    }
  };

  return (
    <Modal title={`Invite @${agent.slug}`} onClose={onClose}>
      {servers.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--bf-gray)' }}>
          You don&apos;t have any servers yet.{' '}
          <a href="/workspace" className="underline" style={{ color: 'var(--bf-accent)' }}>
            Create one first
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {servers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded p-3"
              style={{ background: 'var(--bf-tertiary)' }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{s.name}</p>
              </div>
              <button
                onClick={() => handleInvite(s.id, s.name)}
                disabled={inviting === s.id}
                className="px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-50 flex-shrink-0 transition-opacity hover:opacity-90"
                style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
              >
                {inviting === s.id ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          ))}
          <p className="text-xs mt-1" style={{ color: 'var(--bf-gray)' }}>
            Don&apos;t see the server you want?{' '}
            <a href="/workspace" className="underline" style={{ color: 'var(--bf-accent)' }}>
              Go to workspace
            </a>{' '}
            to create one first.
          </p>
        </div>
      )}

      {toast && (
        <div className={`mt-4 text-sm rounded p-2 ${toastClass(toast.kind)}`}>
          {toast.text}
        </div>
      )}
    </Modal>
  );
}
