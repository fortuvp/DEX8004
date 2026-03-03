import { REALITY_PROXY_ADDRESS } from "@/lib/contracts/addresses";
import { REALITY_PROXY_ABI } from "@/lib/abi/reality-proxy";

export const realityProxyContract = {
  address: REALITY_PROXY_ADDRESS,
  abi: REALITY_PROXY_ABI,
} as const;
