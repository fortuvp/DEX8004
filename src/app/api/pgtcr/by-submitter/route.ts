import { NextRequest, NextResponse } from "next/server";
import { GraphQLClient, gql } from "graphql-request";
import { getCurateSubgraphUrl, getGoldskyApiKey } from "@/lib/curate-config";

const QUERY = gql`
  query ItemsBySubmitter($submitter: Bytes!, $skip: Int!, $first: Int!) {
    items(
      where: { submitter: $submitter }
      orderBy: includedAt
      orderDirection: desc
      skip: $skip
      first: $first
    ) {
      id
      itemID
      status
      includedAt
      stake
      submitter
      metadata { key0 key1 key2 }
      registry { id }
    }
  }
`;

export async function GET(request: NextRequest) {
  const submitter = request.nextUrl.searchParams.get("submitter")?.toLowerCase();
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get("skip") || "0") || 0);
  const first = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("first") || "60") || 60));

  if (!submitter) {
    return NextResponse.json({ success: false, error: "Missing submitter", items: [] }, { status: 400 });
  }

  try {
    const url = getCurateSubgraphUrl("pgtcr");
    const apiKey = getGoldskyApiKey();
    const client = new GraphQLClient(url, apiKey ? { headers: { "x-api-key": apiKey } } : undefined);
    const res = await client.request<{ items: unknown[] }>(QUERY, { submitter, skip, first });
    return NextResponse.json({ success: true, items: res.items || [], skip, first });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch submitter items", items: [] },
      { status: 500 }
    );
  }
}
