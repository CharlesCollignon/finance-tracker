import { cache } from "react";
import { todayIsoLocal } from "@finance/core/constants";
import {
  propertyPosition,
  type PropertyPosition,
} from "@finance/core/property";
import type { PropertyKind, PropertyUsage } from "@finance/core/types/database";
import * as properties from "@finance/data/properties";
import { createClient } from "@/lib/supabase/server";

/**
 * A user's properties (migration 049) as the Immobilier tab lists them: each
 * with where it stands today for the user, and the total of them. Read by
 * `@finance/data/properties`, shared with the phone; the arithmetic is
 * core's, so the phone's list and this one add up the same way.
 */

export interface PropertySummary {
  id: string;
  name: string;
  kind: PropertyKind;
  usage: PropertyUsage;
  postcode: string | null;
  ownershipShare: number;
  loanCount: number;
  position: PropertyPosition;
}

export interface PropertiesView {
  properties: PropertySummary[];
  total: { value: number; owed: number; netValue: number };
  /** False until migration 049 has run. */
  available: boolean;
}

export const getPropertiesView = cache(
  async (userId: string): Promise<PropertiesView> => {
    const state = await properties.getProperties(await createClient(), userId);
    const today = todayIsoLocal();
    const summaries = state.properties.map(
      ({ property, loans }): PropertySummary => ({
        id: property.id,
        name: property.name,
        kind: property.kind,
        usage: property.usage,
        postcode: property.postcode,
        ownershipShare: property.ownership_share,
        loanCount: loans.length,
        position: propertyPosition(property, loans, today),
      }),
    );
    const sum = (pick: (position: PropertyPosition) => number) =>
      Math.round(
        summaries.reduce((total, { position }) => total + pick(position), 0) *
          100,
      ) / 100;
    return {
      properties: summaries,
      total: {
        value: sum((position) => position.value),
        owed: sum((position) => position.owed),
        netValue: sum((position) => position.netValue),
      },
      available: state.available,
    };
  },
);
