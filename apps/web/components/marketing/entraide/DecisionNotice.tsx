import { EyeSlash } from "@phosphor-icons/react/dist/ssr";
import type { EntraideDecision } from "@finance/core/entraide";
import type { EntraideCopy } from "@finance/core/entraide-copy";

/**
 * Why a message of the reader's is hidden, as the rules promise to say it
 * on the message itself from the moment it takes effect (Digital Services
 * Act, art. 17): what was done, the rule, how it came about, the facts, and
 * how to challenge it. Without a decision to read, only that it is hidden.
 */
export function DecisionNotice({
  decision,
  copy,
}: {
  decision: EntraideDecision | undefined;
  copy: EntraideCopy;
}) {
  const words = copy.decision;
  const rule =
    decision && decision.rule !== "none" ? copy.rules[decision.rule] : null;
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-marketing-ink"
    >
      <EyeSlash size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1.5">
        <p>{words.hidden}</p>
        {decision?.action === "hide" && rule ? (
          <>
            <p className="text-marketing-muted">
              {decision.automatic
                ? words.automatic.replace("{rule}", rule)
                : words.moderator.replace("{rule}", rule)}{" "}
              {decision.automatic
                ? ""
                : decision.fromReport
                  ? words.afterReport
                  : words.ownInitiative}
            </p>
            {decision.facts ? (
              <p className="text-marketing-muted">
                {words.facts.replace("{facts}", decision.facts)}
              </p>
            ) : null}
            <p className="text-marketing-faint">{words.challenge}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
