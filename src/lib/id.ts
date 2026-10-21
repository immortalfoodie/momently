/**
 * Creates a unique identifier with an optional prefix and an 8-character random hex string.
 * WHY: Provides compact, collision-resistant identifiers for domain entities without bloating storage.
 *
 * @param prefix - Optional entity category prefix (e.g. 'item', 'slot', 'patch').
 * @returns An 8-character unique ID, prefixed if specified (e.g., "item_a1b2c3d4").
 */
export function createId(prefix?: string): string {
  const shortHex = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return prefix ? `${prefix}_${shortHex}` : shortHex;
}

/**
 * Creates a deterministic ID generator function seeded for predictable unit testing.
 * WHY: Tests require reproducible snapshots and deterministic assertions without flaky random UUIDs.
 *
 * @param seed - Seed value to initialize the pseudo-random generator sequence.
 * @returns A deterministic ID generation function taking an optional prefix.
 */
export function createIdFactory(
  seed: string | number = 'test',
): (prefix?: string) => string {
  let state =
    typeof seed === 'number'
      ? Math.floor(Math.abs(seed)) || 1
      : Array.from(seed).reduce(
          (acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0,
          12345,
        );

  return (prefix?: string): string => {
    // 32-bit linear congruential generator
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const hex = state.toString(16).padStart(8, '0').slice(0, 8);
    return prefix ? `${prefix}_${hex}` : hex;
  };
}
