import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getActiveCredentials, getWebAuthConfig } from "@/lib/webauth";

export async function createWebAuthAuthenticationOptions() {
  const { rpID } = getWebAuthConfig();
  const credentials = await getActiveCredentials();

  if (!credentials.length) {
    return {
      status: 404,
      body: { error: "Credential WebAuth not registered" },
    };
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: credential.credential_id,
      type: "public-key",
    })),
  });

  return {
    status: 200,
    body: options,
  };
}
