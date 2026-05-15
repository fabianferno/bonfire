'use client';

/**
 * React hook and helpers for interacting with the BonFireAgentINFT contract via
 * Privy's embedded wallet. All chain interaction is funnelled through
 * `useSendTransaction` so we never need to manage a wallet provider directly.
 *
 * Chain: 0G testnet (chainId 16602). Callers should ensure `contractAddress`
 * points to the deployed contract on that chain. Privy's `sendTransaction` will
 * prompt the user to switch chains if their embedded wallet is on a different
 * network.
 */

import { useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { BonFireAgentINFTAbi } from './abi/BonFireAgentINFT';

/** The 0G testnet chain ID. Passed as a hint to Privy's sendTransaction so the
 *  embedded wallet signs on the correct network without requiring a manual
 *  chain-switch step from the user. */
export const OG_TESTNET_CHAIN_ID = 16602;

export interface MintPayload {
  manifestUri: string;
  bundleUri: string;
  sealedDEKBaseUri: string;
  /** 0x-prefixed 32-byte hex string as returned by the backend /v1/agents/mint endpoint. */
  bundleHash: `0x${string}`;
  /** Always `0` from our mint API (legacy ABI arg). */
  mode: 0 | 1;
}

export interface MintResult {
  txHash: `0x${string}`;
}

/**
 * Returns an async `mint` function that encodes calldata for
 * `BonFireAgentINFT.mint(...)` and dispatches it via Privy's embedded wallet.
 *
 * @returns `{ mint }` — call `mint({ payload, contractAddress })` to trigger
 * the Privy signing modal and submit the transaction.
 *
 * @example
 * ```tsx
 * const { mint } = useMintAgent();
 * const { txHash } = await mint({ payload: mintPayload, contractAddress });
 * ```
 */
export function useMintAgent() {
  const { sendTransaction } = useSendTransaction();

  async function mint(opts: {
    payload: MintPayload;
    contractAddress: string;
  }): Promise<MintResult> {
    const { payload, contractAddress } = opts;

    // Encode the mint(manifestUri, bundleUri, sealedDEKBaseUri, bundleHash, mode)
    // calldata using viem so we send a raw `data` field and stay provider-agnostic.
    const data = encodeFunctionData({
      abi: BonFireAgentINFTAbi,
      functionName: 'mint',
      args: [
        payload.manifestUri,
        payload.bundleUri,
        payload.sealedDEKBaseUri,
        payload.bundleHash,
        payload.mode,
      ],
    });

    // chainId hint ensures Privy prompts the user to switch to 0G testnet if
    // their embedded wallet is currently configured for a different network.
    const result = await sendTransaction({
      to: contractAddress,
      data,
      chainId: OG_TESTNET_CHAIN_ID,
    });

    return { txHash: result.hash };
  }

  return { mint };
}
