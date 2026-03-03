import { NextResponse } from "next/server";
import { getNetworkSummary } from "@/lib/network-summary.server";

export async function GET() {
  try {
    const data = await getNetworkSummary();
    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      items: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to compute network summary",
      },
      { status: 500 }
    );
  }
}

