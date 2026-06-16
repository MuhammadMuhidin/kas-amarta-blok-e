import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  getActiveCredential,
  getWebAuthConfig,
  getWebAuthRpName,
  saveCredential,
} from "@/lib/webauth";

export async function createWebAuthRegistrationOptions() {
  const { rpID } = getWebAuthConfig();
  const [rpName, activeCredential] = await Promise.all([
    getWebAuthRpName(),
    getActiveCredential(),
  ]);

  return generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from("admin"),
    userName: "admin",
    userDisplayName: "Admin",
    attestationType: "none",
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: activeCredential
      ? [
          {
            id: activeCredential.credential_id,
            type: "public-key",
          },
        ]
      : [],
  });
}

export async function verifyWebAuthRegistration({ body, challenge }) {
  if (!challenge) {
    return {
      status: 401,
      body: { error: "Challenge register expired" },
    };
  }

  const { rpID, origin } = getWebAuthConfig();
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (!verification.verified) {
    return {
      status: 401,
      body: { error: "Register WebAuth failed" },
    };
  }

  const credential = verification.registrationInfo?.credential;

  if (
    !credential ||
    !credential.id ||
    !credential.publicKey ||
    typeof credential.counter !== "number"
  ) {
    return {
      status: 400,
      body: { error: "Credential WebAuth not completed" },
    };
  }

  await saveCredential({
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
  });

  return {
    status: 200,
    body: { ok: true },
  };
}
