/**
 * 0G Storage client abstraction.
 *
 * Mock mode (OG_STORAGE_MOCK=1): writes/reads from backend/.storage-mock/<sha256-of-key>.bin.
 * Real mode: uses @0glabs/0g-ts-sdk with OG_INDEXER_URL, OG_BLOCKCHAIN_RPC, OG_PRIVATE_KEY.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface OgStorageClient {
  /**
   * Upload binary data under a logical key.
   *
   * @param key - Logical storage key (e.g. "publicManifest/42.json")
   * @param data - Raw bytes to store
   * @returns URI that can be passed to fetch() to retrieve the same bytes
   */
  upload(key: string, data: Buffer): Promise<string>;

  /**
   * Fetch binary data by URI returned from a previous upload() call.
   *
   * @param uri - URI returned by upload()
   * @returns Raw bytes as a Buffer
   * @throws Error if the URI does not resolve to stored data
   */
  fetch(uri: string): Promise<Buffer>;
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

function keyToFilename(key: string): string {
  return createHash('sha256').update(key).digest('hex') + '.bin';
}

function mockDir(): string {
  // src/storage-0g/client.ts -> up two levels -> backend/
  const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  return join(backendRoot, '.storage-mock');
}

function createMockStorage(): OgStorageClient {
  return {
    async upload(key: string, data: Buffer): Promise<string> {
      const dir = mockDir();
      await mkdir(dir, { recursive: true });
      const filename = keyToFilename(key);
      await writeFile(join(dir, filename), data);
      return `mock://${filename.replace('.bin', '')}`;
    },

    async fetch(uri: string): Promise<Buffer> {
      if (!uri.startsWith('mock://')) {
        throw new Error(`Mock storage cannot resolve non-mock URI: ${uri}`);
      }
      const hash = uri.slice('mock://'.length);
      const dir = mockDir();
      const filePath = join(dir, hash + '.bin');
      if (!existsSync(filePath)) {
        throw new Error(`Mock storage: no entry for URI ${uri}`);
      }
      return readFile(filePath);
    },
  };
}

// ---------------------------------------------------------------------------
// Real implementation (0G network via @0glabs/0g-ts-sdk)
// ---------------------------------------------------------------------------

// Lazily loaded to avoid SDK's ethers/crypto deps in mock/test mode.
type SdkModule = typeof import('@0glabs/0g-ts-sdk');

let _sdk: SdkModule | null = null;
let _sdkError: string | null = null;

async function loadSdk(): Promise<SdkModule> {
  if (_sdkError) {
    throw new Error(`@0glabs/0g-ts-sdk failed to load: ${_sdkError}`);
  }
  if (_sdk) return _sdk;

  try {
    // Dynamic import defers loading until first real upload/fetch call.
    _sdk = (await import('@0glabs/0g-ts-sdk')) as SdkModule;
    return _sdk;
  } catch (err) {
    _sdkError = String(err);
    throw new Error(
      `Failed to load @0glabs/0g-ts-sdk — install it or set OG_STORAGE_MOCK=1: ${_sdkError}`,
    );
  }
}

/**
 * Real 0G storage client.
 *
 * Environment variables required:
 *   OG_INDEXER_URL    — 0G indexer URL (default: https://indexer-storage-testnet-turbo.0g.ai)
 *   OG_BLOCKCHAIN_RPC — 0G chain JSON-RPC (default: https://evmrpc-testnet.0g.ai)
 *   OG_PRIVATE_KEY    — Hex private key for the upload signer wallet
 */
function createRealStorage(): OgStorageClient {
  const indexerUrl =
    process.env.OG_INDEXER_URL ?? 'https://indexer-storage-testnet-turbo.0g.ai';
  const blockchainRpc =
    process.env.OG_BLOCKCHAIN_RPC ?? 'https://evmrpc-testnet.0g.ai';
  const privateKey = process.env.OG_PRIVATE_KEY ?? '';

  return {
    async upload(key: string, data: Buffer): Promise<string> {
      const { Indexer, MemData } = await loadSdk();
      const { ethers } = await import('ethers');

      if (!privateKey) {
        throw new Error('OG_PRIVATE_KEY env var is required for real 0G storage');
      }

      const signer = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(blockchainRpc));
      const indexer = new Indexer(indexerUrl);

      const file = new MemData(data);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Cast: @0glabs/0g-ts-sdk bundles CJS ethers; ESM/CJS dual-package hazard.
      const [result, err] = await indexer.upload(file, blockchainRpc, signer as any);
      if (err) {
        throw new Error(`0G upload failed for key "${key}": ${err.message}`);
      }

      return `0g://${result.rootHash}`;
    },

    async fetch(uri: string): Promise<Buffer> {
      if (!uri.startsWith('0g://')) {
        throw new Error(`Real 0G storage cannot resolve non-0g URI: ${uri}`);
      }

      const rootHash = uri.slice('0g://'.length);
      const { Indexer } = await loadSdk();

      const indexer = new Indexer(indexerUrl);

      const { tmpdir } = await import('node:os');
      const { randomBytes } = await import('node:crypto');
      const tmpFile = join(tmpdir(), `og-download-${randomBytes(8).toString('hex')}.bin`);

      const err = await indexer.download(rootHash, tmpFile, /* proof */ false);
      if (err) {
        throw new Error(`0G download failed for URI "${uri}": ${err.message}`);
      }

      const buf = await readFile(tmpFile);
      import('node:fs').then((fs) => fs.promises.unlink(tmpFile)).catch(() => {}); // best-effort cleanup

      return buf;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an OgStorageClient.
 *
 * @param opts.mock - Force mock mode (overrides OG_STORAGE_MOCK env var)
 */
export function createOgStorage(opts?: { mock?: boolean }): OgStorageClient {
  const useMock =
    opts?.mock === true ||
    process.env.OG_STORAGE_MOCK === '1' ||
    process.env.OG_STORAGE_MOCK === 'true';

  return useMock ? createMockStorage() : createRealStorage();
}
