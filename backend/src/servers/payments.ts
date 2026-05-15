/**
 * Payment verification for paid agent invites.
 *
 * `verifyAgentInvitePayment` reads the transaction from the 0G testnet RPC,
 * asserts that:
 *  - the tx went to the correct `toAddress` (agent owner wallet)
 *  - the tx value matches `expectedOgAmount` (in OG, parsed as ether)
 *  - the tx receipt `status === 1` (mined and successful)
 *
 * The duplicate-tx guard (ensuring the same txHash can't be used twice) is
 * enforced at the route level by checking `serverMembers` for an existing row
 * with `paidTxHash === txHash` before calling this function.
 */

import { JsonRpcProvider, parseEther } from 'ethers';
import { log } from '../util/logger.js';

export interface VerifyPaymentInput {
  txHash: string;
  /** Wallet address the payment was expected to go to (agent ownerWallet). */
  toAddress: string;
  /** Amount in OG, as a decimal string (e.g. "0.5", "1", "1.25"). */
  expectedOgAmount: string;
}

export interface VerifyPaymentResult {
  ok: true;
  from: string;
}

export class PaymentVerificationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PaymentVerificationError';
  }
}

export async function verifyAgentInvitePayment(
  input: VerifyPaymentInput,
): Promise<VerifyPaymentResult> {
  const rpcUrl = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  const provider = new JsonRpcProvider(rpcUrl);

  log.debug({ txHash: input.txHash, to: input.toAddress, amount: input.expectedOgAmount }, 'verifying agent invite payment');

  // Fetch the raw transaction (for value + to fields).
  const tx = await provider.getTransaction(input.txHash);
  if (!tx) {
    throw new PaymentVerificationError('tx_not_found', `Transaction ${input.txHash} not found on chain`);
  }

  // Verify the recipient matches.
  if (!tx.to || tx.to.toLowerCase() !== input.toAddress.toLowerCase()) {
    throw new PaymentVerificationError(
      'wrong_recipient',
      `Transaction recipient ${tx.to ?? 'null'} does not match expected ${input.toAddress}`,
    );
  }

  // Verify the value matches (parse expectedOgAmount as ether → wei bigint).
  const expectedWei = parseEther(input.expectedOgAmount);
  if (tx.value !== expectedWei) {
    throw new PaymentVerificationError(
      'wrong_amount',
      `Transaction value ${tx.value.toString()} wei does not match expected ${expectedWei.toString()} wei (${input.expectedOgAmount} OG)`,
    );
  }

  // Fetch the receipt to confirm the tx was mined successfully.
  const receipt = await provider.getTransactionReceipt(input.txHash);
  if (!receipt) {
    throw new PaymentVerificationError('receipt_not_found', `Receipt for ${input.txHash} not found — transaction may not be mined yet`);
  }
  if (receipt.status !== 1) {
    throw new PaymentVerificationError('tx_reverted', `Transaction ${input.txHash} was reverted (status=${receipt.status})`);
  }

  return { ok: true, from: tx.from };
}
