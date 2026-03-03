import { NextRequest, NextResponse } from "next/server";
import { fetchPgtcrItemByItemIdBytes } from "@/lib/pgtcr-subgraph";

export async function GET(request: NextRequest) {
  const itemID = request.nextUrl.searchParams.get("itemID");
  if (!itemID) return NextResponse.json({ success: false, error: "Missing itemID" }, { status: 400 });

  try {
    const item = await fetchPgtcrItemByItemIdBytes(itemID);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch PGTCR item" },
      { status: 500 }
    );
  }
}
