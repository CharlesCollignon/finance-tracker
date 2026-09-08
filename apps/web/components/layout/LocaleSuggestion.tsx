import { suggestLocale } from "@finance/core/i18n/locale-suggestion";
import { translator } from "@finance/core/i18n/t";
import { getLocaleContext } from "@/lib/locale";
import {
  acceptLocaleSuggestion,
  dismissLocaleSuggestion,
} from "@/lib/actions/locale";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/**
 * "You seem to be in France — read Pluclair in French?"
 *
 * Renders nothing almost always: only when the edge reports a country, that
 * country suggests a language, that language is not the one on screen, and
 * the reader has not already answered. `suggestLocale` holds that rule and is
 * unit-tested; this file holds only the asking.
 *
 * Two things about the copy. The offer is written in the language being
 * offered and the refusal in the language in use, so whichever of the two the
 * reader actually knows, the half of the banner that matters to them is
 * legible — a French offer with a French "no thanks" is no use to somebody
 * who cannot read either. And it is a question with two buttons rather than a
 * notice about a switch that has already happened: a country is a guess about
 * a person, and an app that acts on that guess can land somebody in a
 * language they cannot read well enough to change back.
 *
 * Plain forms, no client component. Both answers are a server round trip
 * anyway — the language lives in a cookie and a table, and most of the
 * strings are rendered on the server — so there is nothing for client
 * JavaScript to do here, and the banner works before any of it has loaded.
 */
export async function LocaleSuggestion() {
  const { locale, country, asked } = await getLocaleContext();
  const suggested = suggestLocale({ current: locale, country, asked });

  if (!suggested) {
    return null;
  }

  const offer = translator(suggested);
  const current = translator(locale);

  return (
    <aside
      // Not `role="alert"`: this interrupts nothing and is not urgent. It is
      // a region a reader can come to, and it is labelled by its own question.
      aria-label={offer("locale.suggest.title")}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2.5"
    >
      <p className={cn(MICRO, "text-muted-foreground")}>
        <span className="font-medium text-foreground">
          {offer("locale.suggest.title")}
        </span>{" "}
        {offer("locale.suggest.body")}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <form action={acceptLocaleSuggestion.bind(null, suggested)}>
          <button
            type="submit"
            className={cn(
              MICRO,
              "rounded-full bg-foreground px-3 py-1.5 font-medium text-background",
            )}
          >
            {offer("locale.suggest.accept")}
          </button>
        </form>
        <form action={dismissLocaleSuggestion}>
          <button
            type="submit"
            className={cn(MICRO, "px-2 py-1.5 text-muted-foreground underline")}
          >
            {current("locale.suggest.dismiss")}
          </button>
        </form>
      </div>
    </aside>
  );
}
