export const REALITY_TEMPLATE_ID_BOOL = 0n;

export const DEFAULT_TIMEOUT_SECONDS = 60 * 60; // 1h

export function buildAbuseQuestionText(params: {
  agentId: string;
  agentName?: string;
  agentUri?: string | null;
  owner?: string;
  network?: string;
  chainId?: string;
  reporter?: string;
  description: string;
  evidenceUrls?: string[];
}) {
  const lines: string[] = [];
  lines.push(`ERC-8004 Agent abuse report (YES/NO).`);
  lines.push(`AgentId: ${params.agentId}`);
  if (params.network) lines.push(`AgentNetwork: ${params.network}`);
  if (params.chainId) lines.push(`AgentChainId: ${params.chainId}`);
  if (params.agentName) lines.push(`AgentName: ${params.agentName}`);
  if (params.agentUri) lines.push(`AgentURI: ${params.agentUri}`);
  if (params.owner) lines.push(`Owner: ${params.owner}`);
  if (params.reporter) lines.push(`Reporter: ${params.reporter}`);
  lines.push(`Claim: ${params.description.trim()}`);
  if (params.evidenceUrls?.length) {
    lines.push(`Evidence:`);
    for (const u of params.evidenceUrls) lines.push(`- ${u}`);
  }
  lines.push("");
  lines.push("");
  lines.push("Question: Did this agent commit fraud by violating the policy?");
  lines.push("Answer rule: YES if fraud/policy-violation occurred, NO otherwise.");

  return lines.join("\n");
}
