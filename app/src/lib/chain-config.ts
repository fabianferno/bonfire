/**
 * Single source of truth for 0G chain network parameters used across the app.
 *
 * Defaults target the 0G Aristotle mainnet (chainId 16661). Override per
 * deployment by setting `NEXT_PUBLIC_OG_*` env vars in .env.local — useful
 * for pointing a dev build at the Galileo testnet without touching code.
 *
 * Consumers:
 *   - PrivyClientProvider           — defineChain() + Privy supportedChains
 *   - lib/inft.ts                   — chainId hint passed to sendTransaction
 *   - lib/server-wallet.ts          — same
 *   - components/agent/...Modal     — explorer URL for tx/address links
 *   - components/layout/StatusBar   — RPC + explorer for the status chip
 */

import { defineChain, type Chain } from 'viem';

const num = (v: string | undefined, fallback: number): number => {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const OG_CHAIN_ID: number = num(process.env.NEXT_PUBLIC_OG_CHAIN_ID, 16661);
export const OG_RPC_URL: string =
  process.env.NEXT_PUBLIC_OG_RPC_URL ?? 'https://evmrpc.0g.ai';
export const OG_EXPLORER_URL: string =
  process.env.NEXT_PUBLIC_OG_EXPLORER_URL ?? 'https://chainscan.0g.ai';
export const OG_NETWORK_NAME: string =
  process.env.NEXT_PUBLIC_OG_NETWORK_NAME ?? '0G Aristotle Mainnet';
/** True when chainId is the known Galileo testnet (16602). */
export const OG_IS_TESTNET: boolean = OG_CHAIN_ID === 16602;

/**
 * Backwards-compat alias. New code should import `OG_CHAIN_ID` directly.
 * Kept so a stale build can still resolve the old import without crashing.
 * @deprecated
 */
export const OG_TESTNET_CHAIN_ID: number = OG_CHAIN_ID;

/** viem Chain definition used by Privy's supportedChains. */
export const ogChain: Chain = defineChain({
  id: OG_CHAIN_ID,
  name: OG_NETWORK_NAME,
  nativeCurrency: { name: 'OG', symbol: 'OG', decimals: 18 },
  rpcUrls: { default: { http: [OG_RPC_URL] } },
  blockExplorers: { default: { name: '0G Explorer', url: OG_EXPLORER_URL } },
  testnet: OG_IS_TESTNET,
});
