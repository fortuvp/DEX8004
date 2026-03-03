import { ESCROW_ABI } from "@/lib/abi/escrow";
import { ESCROW_ADDRESS } from "@/lib/contracts/addresses";

export const escrowContract = {
  address: ESCROW_ADDRESS,
  abi: ESCROW_ABI,
} as const;

export enum EscrowStatus {
  NoDispute = 0,
  WaitingSender = 1,
  WaitingReceiver = 2,
  DisputeCreated = 3,
  Resolved = 4,
}

export function escrowStatusLabel(status: number) {
  switch (status) {
    case EscrowStatus.NoDispute:
      return "No dispute";
    case EscrowStatus.WaitingSender:
      return "Waiting sender fee";
    case EscrowStatus.WaitingReceiver:
      return "Waiting receiver fee";
    case EscrowStatus.DisputeCreated:
      return "Dispute created";
    case EscrowStatus.Resolved:
      return "Resolved";
    default:
      return `Unknown (${status})`;
  }
}

export type EscrowTransaction = {
  id: bigint;
  sender: `0x${string}`;
  receiver: `0x${string}`;
  amount: bigint;
  timeoutPayment: bigint;
  disputeId: bigint;
  senderFee: bigint;
  receiverFee: bigint;
  lastInteraction: bigint;
  status: number;
  metaEvidence?: string;
};
