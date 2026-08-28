import { supabase } from "@/lib/supabase";

export type PasskeyResult = { error?: string };

export type PasskeyItem = {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
};

type PasskeysModule = typeof import("react-native-passkeys");
type CreatedPasskey = NonNullable<
  Awaited<ReturnType<PasskeysModule["create"]>>
>;

function passkeyError(error: { message: string } | null | undefined): string {
  return error?.message ?? "Passkey request failed.";
}

async function loadPasskeys(): Promise<PasskeysModule | null> {
  try {
    return await import("react-native-passkeys");
  } catch (err) {
    console.error("Failed to load react-native-passkeys", err);
    return null;
  }
}

function cancelledOrUnsupported(passkeys: PasskeysModule | null): string {
  if (!passkeys?.isSupported()) {
    return "Passkeys are not available on this device.";
  }
  return "Passkey prompt was cancelled.";
}

/**
 * Strip native-only helpers (e.g. getPublicKey) before sending JSON
 * back to Supabase Auth.
 */
function registrationPayload(credential: CreatedPasskey) {
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
  const passkeys = await loadPasskeys();
  if (!passkeys) {
    return { error: cancelledOrUnsupported(null) };
  }

  const { data, error } = await supabase.auth.passkey.startAuthentication();
  if (error || !data) {
    return { error: passkeyError(error) };
  }

  try {
    const credential = await passkeys.get(
      data.options as Parameters<PasskeysModule["get"]>[0],
    );
    if (!credential) {
      return { error: cancelledOrUnsupported(passkeys) };
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
      error:
        err instanceof Error ? err.message : cancelledOrUnsupported(passkeys),
    };
  }
}

export async function registerPasskeyCeremony(): Promise<PasskeyResult> {
  const passkeys = await loadPasskeys();
  if (!passkeys) {
    return { error: cancelledOrUnsupported(null) };
  }

  const { data, error } = await supabase.auth.passkey.startRegistration();
  if (error || !data) {
    return { error: passkeyError(error) };
  }

  try {
    const credential = await passkeys.create(
      data.options as Parameters<PasskeysModule["create"]>[0],
    );
    if (!credential) {
      return { error: cancelledOrUnsupported(passkeys) };
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
      error:
        err instanceof Error ? err.message : cancelledOrUnsupported(passkeys),
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

export async function deletePasskey(passkeyId: string): Promise<PasskeyResult> {
  const { error } = await supabase.auth.passkey.delete({ passkeyId });
  if (error) {
    return { error: error.message };
  }
  return {};
}
