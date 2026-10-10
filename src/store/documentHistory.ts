export const HISTORY_LIMIT = 50;
export const HISTORY_BYTE_BUDGET = 100 * 1024 * 1024;
export interface DocumentSnapshot {
  key: string;
  timestamp: number;
  title: string;
  content: string;
  revision: number;
  monacoVersion: number;
}
const sizes = new WeakMap<object, number>();
export function snapshotBytes(item: { content: string }): number {
  let bytes = sizes.get(item);
  if (bytes === undefined) {
    bytes = new TextEncoder().encode(item.content).byteLength;
    sizes.set(item, bytes);
  }
  return bytes;
}
export function retainHistory<T extends { content: string }>(
  history: T[],
  budget = HISTORY_BYTE_BUDGET,
): T[] {
  let bytes = 0;
  return history.slice(0, HISTORY_LIMIT).filter((item) => {
    const size = snapshotBytes(item);
    if (bytes + size > budget) return false;
    bytes += size;
    return true;
  });
}
