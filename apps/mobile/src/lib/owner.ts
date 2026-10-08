import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whose money the shared screens show on this phone: the person's, or their
 * shared space's under « Commun » (`docs/plans/SHARED_SPACE_DESIGN.md`).
 *
 * The choice is remembered on the device as the space's id, and honoured
 * only while the person is still in that space — `OwnerProvider` decides.
 * It also leaves the answer here, where the writes in `mutations.ts` read
 * it: they run from presses, outside any component, and a row added under
 * « Commun » has to land in the space.
 */

const STORAGE_KEY = "owner-shown";

let shownSpace: string | null = null;

/** The space on screen, or null for the person's own money. */
export function setShownSpace(spaceId: string | null): void {
  shownSpace = spaceId;
}

/** Whose rows a write from the shared screens goes to. */
export function ownerFor(userId: string): string {
  return shownSpace ?? userId;
}

export async function loadOwnerChoice(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function saveOwnerChoice(spaceId: string | null): Promise<void> {
  try {
    if (spaceId) {
      await AsyncStorage.setItem(STORAGE_KEY, spaceId);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Not remembered: the switch still holds for this launch.
  }
}

const MY_SHARE_KEY = "my-share";

/** « Avec ma part du commun » on Le point (6b), remembered on the device. */
export async function loadMyShare(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MY_SHARE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function saveMyShare(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(MY_SHARE_KEY, on ? "1" : "0");
  } catch {
    // Not remembered: the switch still holds for this launch.
  }
}
