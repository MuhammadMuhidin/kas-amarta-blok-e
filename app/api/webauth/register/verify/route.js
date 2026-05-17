import { NextResponse } from "next/server";
import {
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  isoBase64URL,
} from "@simplewebauthn/server/helpers";
import {
  getWebAuthConfig,
  saveCredential,
} from "@/lib/webauth";

export async function POST(req) {
  try {
    const body =
      await req.json();

    const challenge =
      req.cookies.get(
        "webauth_register_challenge"
      )?.value;

    if (!challenge) {
      return NextResponse.json(
        {
          error:
            "Challenge register expired",
        },
        {
          status: 401,
        }
      );
    }

    const {
      rpID,
      origin,
    } = getWebAuthConfig();

    const verification =
      await verifyRegistrationResponse({
        response: body,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });

    if (!verification.verified) {
      return NextResponse.json(
        {
          error:
            "Register WebAuth gagal",
        },
        {
          status: 401,
        }
      );
    }

    const info =
      verification.registrationInfo;

    if (
      !info ||
      !info.credentialID ||
      !info.credentialPublicKey
    ) {
      return NextResponse.json(
        {
          error:
            "Credential WebAuth tidak lengkap",
        },
        {
          status: 400,
        }
      );
    }

    await saveCredential({
      credentialId:
        isoBase64URL.fromBuffer(
          info.credentialID
        ),
      publicKey:
        isoBase64URL.fromBuffer(
          info.credentialPublicKey
        ),
      counter: info.counter,
    });

    const res =
      NextResponse.json({
        ok: true,
      });

    res.cookies.delete(
      "webauth_register_challenge"
    );

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err.message ||
          "Verify register gagal",
      },
      {
        status: 500,
      }
    );
  }
}
