'use client';
import type { BackendAgent } from '@/lib/types';

interface Props {
  agent: BackendAgent;
  onInvite: (a: BackendAgent) => void;
}

export default function AgentCard({ agent, onInvite }: Props) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--bf-secondary)' }}
    >
      <div className="flex items-start gap-3">
        {agent.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.avatarUrl}
            alt={agent.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: 'var(--bf-quinary)', color: 'var(--bf-white)' }}
          >
            {agent.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{agent.name}</h3>
          <p className="text-xs" style={{ color: 'var(--bf-symbol)' }}>
            @{agent.slug}
          </p>
        </div>
      </div>

      <p className="text-sm line-clamp-3" style={{ color: 'var(--bf-gray)' }}>
        {agent.description}
      </p>

      {agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--bf-quinary)', color: 'var(--bf-gray)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onInvite(agent)}
        className="mt-auto px-3 py-1.5 rounded text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: 'var(--bf-fire)', color: 'var(--bf-white)' }}
      >
        Invite
      </button>
    </div>
  );
}
