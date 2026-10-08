import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getMySpace, type Space } from "@finance/data/spaces";

import { useDataVersion } from "@/lib/data-version";
import { hapticSelection } from "@/lib/haptics";
import {
  loadMyShare,
  loadOwnerChoice,
  saveMyShare,
  saveOwnerChoice,
  setShownSpace,
} from "@/lib/owner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

interface OwnerContextValue {
  /** Who is signed in. */
  userId: string | null;
  /** Whose money the shared screens read and write: theirs, or the space's. */
  ownerId: string | null;
  /** The space they are in, or null. */
  space: Space | null;
  /** Whether « Commun » is on screen. */
  joint: boolean;
  setJoint: (joint: boolean) => void;
  /**
   * Show a space by its id — right after joining it, before the space has
   * been read again.
   */
  showSpace: (spaceId: string) => void;
  /** « Avec ma part du commun » on Le point (6b). */
  myShare: boolean;
  setMyShare: (on: boolean) => void;
}

const OwnerContext = createContext<OwnerContextValue | null>(null);

/**
 * The owner on screen, the phone's counterpart of the web's `getOwner`.
 *
 * The space is read again whenever anything is written that could change
 * it — making, joining or leaving one announces itself to every screen —
 * and a choice naming a space the person has left falls back to them.
 * Switching moves `ownerId`, which every shared screen loads by, so the
 * screens in view read again on their own.
 */
export function OwnerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const version = useDataVersion(["preferences"]);
  const [loaded, setLoaded] = useState<{
    userId: string;
    space: Space | null;
  } | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [myShare, setMyShareState] = useState(false);

  useEffect(() => {
    void loadOwnerChoice().then(setChosen);
    void loadMyShare().then(setMyShareState);
  }, []);

  const setMyShare = useCallback((on: boolean) => {
    void hapticSelection();
    setMyShareState(on);
    void saveMyShare(on);
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let live = true;
    getMySpace(supabase, userId)
      .then((space) => {
        if (live) {
          setLoaded({ userId, space });
        }
      })
      .catch(() => {
        // Kept as it was: a failed read is not a space left.
      });
    return () => {
      live = false;
    };
  }, [userId, version]);

  const space = loaded && loaded.userId === userId ? loaded.space : null;
  const joint = space !== null && chosen === space.id;
  const ownerId = userId ? (joint ? space.id : userId) : null;

  useEffect(() => {
    setShownSpace(joint && space ? space.id : null);
  }, [joint, space]);

  const choose = useCallback((target: string | null) => {
    setShownSpace(target);
    setChosen(target);
    void saveOwnerChoice(target);
  }, []);

  const spaceId = space?.id ?? null;
  const setJoint = useCallback(
    (next: boolean) => {
      void hapticSelection();
      choose(next ? spaceId : null);
    },
    [choose, spaceId],
  );

  const value = useMemo(
    () => ({
      userId,
      ownerId,
      space,
      joint,
      setJoint,
      showSpace: choose,
      myShare,
      setMyShare,
    }),
    [userId, ownerId, space, joint, setJoint, choose, myShare, setMyShare],
  );

  return (
    <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>
  );
}

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) {
    throw new Error("useOwner must be used within OwnerProvider");
  }
  return ctx;
}
