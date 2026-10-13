import type { StaticImageData } from "next/image";
import type { GuideSlug } from "@/lib/guide-list";
import bilanDuMois from "@/content/guides/covers/bilan-du-mois.jpg";
import jourDeLecture from "@/content/guides/covers/jour-de-lecture.jpg";
import peaCtoAssuranceViePer from "@/content/guides/covers/pea-cto-assurance-vie-per.jpg";

/**
 * Each guide's photo, from Unsplash, free to use under the Unsplash License
 * (checked on its page on 2026-10-13) and credited under the guide's cover
 * all the same. Kept in the repository at 2400px wide, so `next/image`
 * makes every smaller size from it and the site depends on no one else's
 * server.
 */
export interface GuideCoverPhoto {
  image: StaticImageData;
  /** What it shows, for a reader who cannot see it. */
  alt: string;
  /** `object-position`: what stays in frame when it is cropped thin. */
  focus: string;
  credit: { name: string; profile: string; photo: string };
}

export const GUIDE_COVERS: Record<GuideSlug, GuideCoverPhoto> = {
  "jour-de-lecture": {
    image: jourDeLecture,
    alt: "Un calendrier, quelques jours épinglés en rouge et le 30 entouré.",
    focus: "50% 80%",
    credit: {
      name: "Towfiqu barbhuiya",
      profile: "https://unsplash.com/@towfiqu999999",
      photo: "https://unsplash.com/photos/bwOAixLG0uc",
    },
  },
  "bilan-du-mois": {
    image: bilanDuMois,
    alt: "Une calculatrice de bureau sur une table sombre.",
    focus: "25% 60%",
    credit: {
      name: "dostonxd",
      profile: "https://unsplash.com/@dostonxd",
      photo: "https://unsplash.com/photos/Hlbfm6J7VR8",
    },
  },
  "pea-cto-assurance-vie-per": {
    image: peaCtoAssuranceViePer,
    alt: "Une figurine qui lit son journal, assise sur une pile de pièces en euros.",
    focus: "50% 40%",
    credit: {
      name: "Mathieu Stern",
      profile: "https://unsplash.com/@mathieustern",
      photo: "https://unsplash.com/photos/1zO4O3Z0UJA",
    },
  },
};
