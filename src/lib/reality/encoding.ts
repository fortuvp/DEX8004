import { toHex } from "viem";

export type YesNo = "YES" | "NO";

export function yesNoToBytes32(v: YesNo) {
  const n = v === "YES" ? 1n : 0n;
  return toHex(n, { size: 32 });
}

export function bytes32ToYesNo(v: `0x${string}`): YesNo | "UNKNOWN" {
  try {
    const lastByte = BigInt(v);
    if (lastByte === 0n) return "NO";
    if (lastByte === 1n) return "YES";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
