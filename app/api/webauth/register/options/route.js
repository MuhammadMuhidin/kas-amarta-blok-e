import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
} from "@simplewebauthn/server";

import {
  getActiveCredential,
  getWebAuthConfig,
} from "@/lib/webauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { rpName, rpID } =
      getWebAuthConfig();

    const activeCredential =
      await getActiveCredential();

    const options =
      await generateRegistrationOptions({
        rpName,
        rpID,

        userID:
          Buffer.from("admin"),

        userName:
          "admin",

        userDisplayName:
          "Admin",

        attestationType:
          "none",

        supportedAlgorithmIDs:
          [-7, -257],

        authenticatorSelection: {
          residentKey:
            "preferred",
          userVerification:
            "required",
        },

        excludeCredentials:
          activeCredential
            ? [
                {
                  id:
                    activeCredential
                      .credential_id,
                  type:
                    "public-key",
                },
              ]
            : [],
      });

    const res =
      NextResponse.json(options);

    res.cookies.set(
      "webauth_register_challenge",
      options.challenge,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 5,
      }
    );

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Gagal membuat register options",
      },
      {
        status: 500,
      }
    );
  }
}
