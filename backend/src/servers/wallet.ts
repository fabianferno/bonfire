import { ethers } from 'ethers';
import type { ServerWalletDoc } from '../db/types.js';

export function createServerWallet(): ServerWalletDoc {
  const w = ethers.Wallet.createRandom();
  return {
    address: w.address,
    privateKey: w.privateKey,
    network: 'og-testnet',
    createdAt: new Date(),
  };
}

/**
 * Query the wallet's native OG balance via the RPC.
 * Returns the balance as a string of OG (decimal), not wei.
 * Throws if the RPC is unreachable.
 */
export async function fetchOnchainBalance(rpcUrl: string, address: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wei = await provider.getBalance(address);
  return ethers.formatEther(wei);
}
