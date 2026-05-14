'use client';
import { useEffect, useState, useCallback } from 'react';
import { bf } from '@/lib/api-bonfire';
import type { BackendServerWallet, BackendServerFunding } from '@/lib/types';

interface Props {
  /** The backend server ID used to fetch wallet info */
  serverId: string;
}

/**
 * Compact inline panel rendered in the server sidebar.
 * Shows the shortened wallet address, live OG balance, and a refresh button.
 * Displays a faucet link when the balance falls below 0.5 OG so users
 * are prompted to top up before inference starts failing.
 */
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
    // Trigger an async fetch on mount and when serverId changes.
    // setState calls happen inside .then/.catch callbacks, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading && !wallet) {
    return (
      <div className="px-3 py-2 text-xs" style={{ color: 'var(--bf-symbol)' }}>
        Loading wallet…
      </div>
    );
  }

  if (error || !wallet) {
    return (
      <div className="px-3 py-2 text-xs" style={{ color: 'var(--bf-symbol)' }}>
        Wallet unavailable
      </div>
    );
  }

  const short = wallet.address.slice(0, 6) + '…' + wallet.address.slice(-4);
  const lowBalance = balance !== null && Number(balance) < 0.5;

  return (
    <div className="px-3 py-2 mb-2 rounded mx-2" style={{ background: 'var(--bf-tertiary)' }}>
      <div className="flex items-baseline justify-between mb-1">
        <p
          className="text-xs uppercase tracking-wider font-semibold"
          style={{ color: 'var(--bf-symbol)' }}
        >
          Server Wallet
        </p>
        <button
          onClick={load}
          className="text-xs"
          style={{ color: 'var(--bf-symbol)' }}
          title="Refresh balance"
        >
          ↻
        </button>
      </div>
      <code className="text-xs font-mono" style={{ color: 'var(--bf-gray)' }}>
        {short}
      </code>
      <div
        className="mt-1 text-sm font-semibold"
        style={{ color: lowBalance ? '#f87171' : 'var(--bf-white)' }}
      >
        {balance !== null ? `${Number(balance).toFixed(4)} OG` : '— OG'}
      </div>
      {lowBalance && funding && (
        <a
          href={funding.faucetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
          style={{ color: 'var(--bf-accent)' }}
        >
          Fund at faucet →
        </a>
      )}
    </div>
  );
}
