import { NextRequest, NextResponse } from "next/server";
import { GraphQLClient, gql } from "graphql-request";
import { getCurateSubgraphUrl, getGoldskyApiKey } from "@/lib/curate-config";

const BY_CHALLENGER = gql`
  query ByChallenger($challenger: Bytes!, $first: Int!) {
    items(where: { challenges_: { challenger: $challenger } }, orderBy: includedAt, orderDirection: desc, first: $first) {
      id
      itemID
      submitter
      status
      metadata { key0 key2 }
      challenges(orderBy: createdAt, orderDirection: desc, first: 8) {
        disputeID
        createdAt
        resolutionTime
        challenger
      }
    }
  }
`;

const BY_SUBMITTER = gql`
  query BySubmitter($submitter: Bytes!, $first: Int!) {
    items(where: { submitter: $submitter }, orderBy: includedAt, orderDirection: desc, first: $first) {
      id
      itemID
      submitter
      status
      metadata { key0 key2 }
      challenges(orderBy: createdAt, orderDirection: desc, first: 8) {
        disputeID
        createdAt
        resolutionTime
        challenger
      }
    }
  }
`;

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.toLowerCase();
  const first = Math.min(120, Math.max(1, Number(request.nextUrl.searchParams.get("first") || "60") || 60));
  if (!address) return NextResponse.json({ success: false, error: "Missing address", items: [] }, { status: 400 });

  try {
    const client = new GraphQLClient(getCurateSubgraphUrl("pgtcr"), (() => {
      const apiKey = getGoldskyApiKey();
      return apiKey ? { headers: { "x-api-key": apiKey } } : undefined;
    })());

    const [a, b] = await Promise.all([
      client.request<{ items: any[] }>(BY_CHALLENGER, { challenger: address, first }),
      client.request<{ items: any[] }>(BY_SUBMITTER, { submitter: address, first }),
    ]);

    const map = new Map<string, any>();
    for (const item of [...(a.items || []), ...(b.items || [])]) {
      if ((item.challenges || []).length > 0) map.set(item.id, item);
    }

    return NextResponse.json({ success: true, items: Array.from(map.values()) });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch disputes", items: [] },
      { status: 500 }
    );
  }
}
