import { useState } from "react";
import { Image, View } from "react-native";

import { instrumentLogoUrl } from "@finance/core/market/logo";

import { CategoryIcon } from "@/components/CategoryIcon";

/**
 * A holding's own mark — the company's or the fund issuer's logo, as the
 * web's `InstrumentLogo` shows it — on a white disc, since brand marks are
 * drawn for a light ground. Falls back to the category's icon when there is
 * no symbol or the logo cannot be fetched: brand marks 404 often.
 */
export function InstrumentLogo({
  symbol,
  fallbackIcon,
}: {
  symbol: string | null;
  fallbackIcon: string | null;
}) {
  const [failed, setFailed] = useState(false);

  if (!symbol || failed) {
    return <CategoryIcon icon={fallbackIcon} className="h-8 w-8 rounded-full" />;
  }

  return (
    <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-white">
      <Image
        source={{ uri: instrumentLogoUrl(symbol) }}
        // A touch larger than the disc, as on the web: most marks carry a
        // margin of their own.
        style={{ width: 40, height: 40 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        onError={() => setFailed(true)}
      />
    </View>
  );
}
