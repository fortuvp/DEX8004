import type { Abi } from "viem";

// Minimal ABI subset for the configured Reality proxy contract.
// Source: Blockscout verified ABI (getabi).
export const REALITY_PROXY_ABI = [
  {
    type: "function",
    name: "realitio",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "metadata",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "getDisputeFee",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [{ name: "fee", type: "uint256" }],
  },
  {
    type: "function",
    name: "requestArbitration",
    stateMutability: "payable",
    inputs: [
      { name: "_questionID", type: "bytes32" },
      { name: "_maxPrevious", type: "uint256" },
    ],
    outputs: [{ name: "disputeID", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitEvidence",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_questionID", type: "uint256" },
      { name: "_evidenceURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "DisputeIDToQuestionID",
    anonymous: false,
    inputs: [
      { indexed: true, name: "_disputeID", type: "uint256" },
      { indexed: false, name: "_questionID", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "Evidence",
    anonymous: false,
    inputs: [
      { indexed: true, name: "_arbitrator", type: "address" },
      { indexed: true, name: "_evidenceGroupID", type: "uint256" },
      { indexed: true, name: "_party", type: "address" },
      { indexed: false, name: "_evidence", type: "string" },
    ],
  },
  {
    type: "event",
    name: "Dispute",
    anonymous: false,
    inputs: [
      { indexed: true, name: "_arbitrator", type: "address" },
      { indexed: true, name: "_disputeID", type: "uint256" },
      { indexed: false, name: "_metaEvidenceID", type: "uint256" },
      { indexed: false, name: "_evidenceGroupID", type: "uint256" },
    ],
  },
] as const satisfies Abi;
