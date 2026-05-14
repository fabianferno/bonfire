'use client';
import { useEffect, useState, useCallback } from 'react';
import { bf } from '@/lib/api-bonfire';
import type { BackendServerWallet, BackendServerFunding } from '@/lib/types';

interface Props {
  serverId: string;
}

function BoostIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L10.5 6H13.5L11 9H13L8 14.5L3 9H5L2.5 6H5.5L8 1.5Z" fill="url(#boost-grad)" />
      <defs>
        <linearGradient id="boost-grad" x1="8" y1="1.5" x2="8" y2="14.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function WalletPanel({ serverId }: Props) {
  const [wallet, setWallet] = useState<BackendServerWallet | null>(null);
  const [funding, setFunding] = useState<BackendServerFunding | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bf.getServerWallet(serverId)
      .then((r) => {
        setWallet(r.wallet);
        setFunding(r.funding);
        setBalance(r.balance);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'failed';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [serverId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading && !wallet) {
    return (
      <div className="mx-2 mb-2 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--bf-symbol)', background: 'var(--bf-quaternary)' }}>
        Loading wallet…
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="mx-2 mb-2 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--bf-symbol)', background: 'var(--bf-quaternary)' }}>
        Wallet unavailable
      </div>
    );
  }

  const short = wallet.address.slice(0, 6) + '…' + wallet.address.slice(-4);
  const bal = balance !== null ? Number(balance) : null;
  const lowBalance = bal !== null && bal < 0.5;

  const tier =
    bal === null ? null :
    bal >= 10   ? { label: "Blazing",  color: "#f97316" } :
    bal >= 2    ? { label: "Powered",  color: "#7c9cf5" } :
    bal >= 0.5  ? { label: "Active",   color: "#57c98a" } :
                  { label: "Low",      color: "#f05b5b" };

  return (
    <div
      className="mx-2 mb-2 rounded-lg px-3 py-2.5"
      style={{ background: 'var(--bf-quaternary)', border: '1px solid var(--bf-quinary)' }}
    >
      {/* Top row: icon + label + refresh */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BoostIcon size={16} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c084fc' }}>
            Server Boost
          </span>
          {tier && (
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${tier.color}22`, color: tier.color, fontSize: 10 }}
            >
              {tier.label}
            </span>
          )}
        </div>
        <button onClick={load} title="Refresh balance" className="text-sm" style={{ color: 'var(--bf-symbol)' }}>
          ↻
        </button>
      </div>

      {/* Balance */}
      <div
        className="text-lg font-bold"
        style={{ color: lowBalance ? '#f05b5b' : '#f2f3f5' }}
      >
        {bal !== null ? `${bal.toFixed(4)} OG` : '— OG'}
      </div>

      {/* Wallet address */}
      <code className="text-xs font-mono mt-0.5 block" style={{ color: 'var(--bf-gray)' }}>
        {short}
      </code>

      {lowBalance && funding && (
        <a
          href={funding.faucetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline mt-1.5 inline-block"
          style={{ color: 'var(--bf-accent)' }}
        >
          Fund at faucet →
        </a>
      )}
    </div>
  );
}
