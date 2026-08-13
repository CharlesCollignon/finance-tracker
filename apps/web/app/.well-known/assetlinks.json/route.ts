import {
  ANDROID_PACKAGE,
  androidSha256Fingerprints,
  wellKnownJsonResponse,
} from "@/lib/mobile-app";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const fingerprints = androidSha256Fingerprints();
  if (fingerprints.length === 0) {
    return wellKnownJsonResponse([]);
  }

  return wellKnownJsonResponse([
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
