import { NextResponse } from "next/server";
import { verifyWebAuthRegistration } from "@/features/auth/webauthRegistrationService";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const challenge = req.cookies.get("webauth_register_challenge")?.value;
    const result = await verifyWebAuthRegistration({ body, challenge });
    const res = NextResponse.json(result.body, { status: result.status });

    if (result.status === 200) {
      res.cookies.delete("webauth_register_challenge");
    }

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "Verify register failed",
      },
      {
        status: 500,
      },
    );
  }
}
