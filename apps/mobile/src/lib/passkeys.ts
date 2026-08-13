import * as Passkeys from "react-native-passkeys";

import { supabase } from "@/lib/supabase";

export type PasskeyResult = { error?: string };

export type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

function passkeyError(error: { message: string } | null | undefined): string {
  return error?.message ?? "Passkey request failed.";
}

function cancelledOrUnsupported(): string {
  if (!Passkeys.isSupported()) {
    return "Passkeys need a development build, not Expo Go.";
  }
  return "Passkey prompt was cancelled.";
}

/**
 * Strip native-only helpers (e.g. getPublicKey) before sending JSON
 * back to Supabase Auth.
 */
function registrationPayload(
  credential: NonNullable<Awaited<ReturnType<typeof Passkeys.create>>>,
) {
  const { getPublicKey: _ignored, ...response } = credential.response;
  return {
    id: credential.id,
    rawId: credential.rawId,
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.clientExtensionResults,
    response,
  };
}

export async function signInWithPasskeyCeremony(): Promise<PasskeyResult> {
  const { data, error } = await supabase.auth.passkey.startAuthentication();
  if (error || !data) {
    return { error: passkeyError(error) };
  }

  try {
    const credential = await Passkeys.get(
      data.options as Parameters<typeof Passkeys.get>[0],
    );
    if (!credential) {
      return { error: cancelledOrUnsupported() };
    }

    const { error: verifyError } =
      await supabase.auth.passkey.verifyAuthentication({
        challengeId: data.challenge_id,
        credential,
      });
    if (verifyError) {
      return { error: verifyError.message };
    }
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : cancelledOrUnsupported(),
    };
  }
}

export async function registerPasskeyCeremony(): Promise<PasskeyResult> {
  const { data, error } = await supabase.auth.passkey.startRegistration();
  if (error || !data) {
    return { error: passkeyError(error) };
  }

  try {
    const credential = await Passkeys.create(
      data.options as Parameters<typeof Passkeys.create>[0],
    );
    if (!credential) {
      return { error: cancelledOrUnsupported() };
    }

    const { error: verifyError } =
      await supabase.auth.passkey.verifyRegistration({
        challengeId: data.challenge_id,
        credential: registrationPayload(credential),
      });
    if (verifyError) {
      return { error: verifyError.message };
    }
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : cancelledOrUnsupported(),
    };
  }
}

export async function listPasskeys(): Promise<{
  passkeys: PasskeyItem[];
  error?: string;
}> {
  const { data, error } = await supabase.auth.passkey.list();
  if (error) {
    return { passkeys: [], error: error.message };
  }
  return { passkeys: data ?? [] };
}

export async function deletePasskey(
  passkeyId: string,
): Promise<PasskeyResult> {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  if (error) {
    return { error: error.message };
  }
  return {};
}
