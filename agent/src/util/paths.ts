import fs from 'node:fs';
import path from 'node:path';

/** Ensure `target` is inside `root` after realpath; throws if not. */
export function assertInside(root: string, target: string): string {
  const rRoot = fs.realpathSync(root);
  const rTarget = fs.realpathSync.native(path.resolve(root, target));
  if (!rTarget.startsWith(rRoot + path.sep) && rTarget !== rRoot) {
    throw new Error(`path escapes agent root: ${target}`);
  }
  return rTarget;
}
