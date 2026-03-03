export type SaleRequest = {
  id: string;
  createdAt: number;
  agentId: string;
  agentName?: string;
  seller: `0x${string}`;
  receiverToPay: `0x${string}`;
  amountWei: string; // bigint serialized
  note?: string;
};
