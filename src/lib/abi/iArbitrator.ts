export const IARBITRATOR_ABI = [
  {
    type: "function",
    name: "arbitrationCost",
    stateMutability: "view",
    inputs: [{ name: "_extraData", type: "bytes" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "appealCost",
    stateMutability: "view",
    inputs: [
      { name: "_disputeID", type: "uint256" },
      { name: "_extraData", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
