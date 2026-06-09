import { NextResponse } from "next/server";
import {
  checkReceiptStorageHealth,
  getReceiptStorageErrorResponse,
} from "@/features/health/receiptStorageService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await checkReceiptStorageHealth();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(getReceiptStorageErrorResponse(error));
  }
}
