import { NextResponse } from "next/server";
import { fetchPgtcrRegistryInfo } from "@/lib/pgtcr-subgraph";

export async function GET() {
  try {
    const registry = await fetchPgtcrRegistryInfo();
    return NextResponse.json({ success: true, registry });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch PGTCR registry" },
      { status: 500 }
    );
  }
}
