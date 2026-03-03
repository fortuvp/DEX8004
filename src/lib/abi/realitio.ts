import type { Abi } from "viem";

// Minimal ABI subset for the Realitio contract used by the Reality proxy.
// Realitio address is discovered via proxy.realitio().
// Source: Blockscout verified ABI (getabi).
export const REALITIO_ABI = [
  {
    type: "event",
    name: "LogNewQuestion",
    anonymous: false,
    inputs: [
      { indexed: true, name: "question_id", type: "bytes32" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "template_id", type: "uint256" },
      { indexed: false, name: "question", type: "string" },
      { indexed: true, name: "content_hash", type: "bytes32" },
      { indexed: false, name: "arbitrator", type: "address" },
      { indexed: false, name: "timeout", type: "uint32" },
      { indexed: false, name: "opening_ts", type: "uint32" },
      { indexed: false, name: "nonce", type: "uint256" },
      { indexed: false, name: "created", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "LogNewAnswer",
    anonymous: false,
    inputs: [
      { indexed: false, name: "answer", type: "bytes32" },
      { indexed: true, name: "question_id", type: "bytes32" },
      { indexed: false, name: "history_hash", type: "bytes32" },
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "bond", type: "uint256" },
      { indexed: false, name: "ts", type: "uint256" },
      { indexed: false, name: "is_commitment", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "askQuestion",
    stateMutability: "payable",
    inputs: [
      { name: "template_id", type: "uint256" },
      { name: "question", type: "string" },
      { name: "arbitrator", type: "address" },
      { name: "timeout", type: "uint32" },
      { name: "opening_ts", type: "uint32" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "arbitrator_question_fees",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "submitAnswer",
    stateMutability: "payable",
    inputs: [
      { name: "question_id", type: "bytes32" },
      { name: "answer", type: "bytes32" },
      { name: "max_previous", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getBestAnswer",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getBond",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getMinBond",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isFinalized",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getFinalizeTS",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "uint32" }],
  },
  {
    type: "function",
    name: "getOpeningTS",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "uint32" }],
  },
  {
    type: "function",
    name: "getTimeout",
    stateMutability: "view",
    inputs: [{ name: "question_id", type: "bytes32" }],
    outputs: [{ type: "uint32" }],
  },
] as const satisfies Abi;
