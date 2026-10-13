/**
 * Where a link from outside the app lands: a file shared to Pluclair from
 * another app (« Partager vers Pluclair », `expo-sharing`) opens the import
 * with it; everything else goes where it says.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (new URL(path).hostname === "expo-sharing") {
      return "/import?shared=1";
    }
  } catch {
    // Not a URL with a host: an in-app path, as it is.
  }
  return path;
}
