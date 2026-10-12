/* Hallmark · genre: atmospheric · macrostructure: Index-First (with a held rail) · theme: design.md (Pluclair) · enrichment: none — the week strip is data, not decoration · nav: kept · footer: kept */

import { GithubLogo, RssSimple } from "@phosphor-icons/react/dist/ssr";
import { changelogPulse, daysBetween } from "@finance/core/changelog";
import { CHANGELOG, CHANGELOG_STATS } from "@finance/core/changelog-entries";
import { formatFullDate, todayIsoLocal } from "@finance/core/constants";
import { getLocale } from "@/lib/locale";
import { SOURCE_URL } from "@/components/marketing/about-copy";
import { ElsewhereLink } from "@/components/marketing/ElsewhereLink";
import { FadeUp, RiseWords } from "@/components/marketing/LandingReveal";
import {
  countLabel,
  NOUVEAUTES_RSS_HREF,
  nouveautesCopyFor,
} from "@/components/marketing/nouveautes-copy";
import { ChangelogRiver } from "@/components/marketing/nouveautes/ChangelogRiver";
import { NouveautesHero } from "@/components/marketing/nouveautes/NouveautesHero";
import { openRoadmap } from "@/components/marketing/nouveautes/open-roadmap";
import { Roadmap } from "@/components/marketing/nouveautes/Roadmap";
import {
  dayAndMonth,
  riverEntry,
} from "@/components/marketing/nouveautes/river-entry";

/**
 * « Nouveautés »: everything that has changed in Pluclair, newest first,
 * from `@finance/core/changelog-entries`.
 *
 * An index rather than a story: a short hero with the rhythm of the work
 * beside it, then the list with what to show held beside it, then what is
 * coming, then how to follow along. See the Motion section of DESIGN.md.
 * `openId` is an entry reached by its own address, open where it stands.
 */
export async function NouveautesPage({ openId }: { openId: string | null }) {
  const locale = await getLocale();
  const copy = nouveautesCopyFor(locale);
  const today = todayIsoLocal();

  const days = Math.max(0, daysBetween(CHANGELOG[0]!.date, today));
  const updated =
    days === 0
      ? copy.hero.updatedToday
      : days === 1
        ? copy.hero.updatedYesterday
        : copy.hero.updatedDaysAgo.replace("{days}", String(days));

  const weeks = changelogPulse(CHANGELOG, CHANGELOG_STATS.since, today).map(
    (week) => ({
      ...week,
      label: `${copy.pulse.week.replace("{date}", dayAndMonth(week.week, locale))} · ${
        week.count > 0
          ? countLabel(copy.river.monthCount, week.count)
          : copy.pulse.none
      }`,
    }),
  );

  return (
    <article className="relative isolate overflow-x-clip">
      <NouveautesHero
        copy={copy}
        updated={updated}
        locale={locale}
        weeks={weeks}
        figures={[
          { value: CHANGELOG.length, label: copy.hero.entries },
          {
            value: CHANGELOG_STATS.commits,
            label: `${copy.hero.commits} ${copy.hero.since.replace(
              "{date}",
              formatFullDate(CHANGELOG_STATS.since, locale),
            )}`,
          },
        ]}
      />

      <ChangelogRiver
        entries={CHANGELOG.map((entry) => riverEntry(entry, locale))}
        copy={copy}
        locale={locale}
        openId={openId}
      />

      <Roadmap items={openRoadmap()} copy={copy} locale={locale} />

      {/* ------------------------------------------------------- follow */}
      <section className="relative px-6 pb-28 md:pb-36">
        <div className="mx-auto max-w-6xl">
          <RiseWords
            text={copy.follow.heading}
            className="marketing-display text-display-sub"
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            <li>
              <FadeUp>
                <ElsewhereLink
                  href={NOUVEAUTES_RSS_HREF}
                  title={copy.follow.rss}
                  detail={copy.follow.rssDetail}
                  icon={<RssSimple size={22} aria-hidden />}
                />
              </FadeUp>
            </li>
            <li>
              <FadeUp delay={0.08}>
                <ElsewhereLink
                  href={SOURCE_URL}
                  title={copy.follow.source}
                  detail={copy.follow.sourceDetail}
                  icon={<GithubLogo size={22} aria-hidden />}
                />
              </FadeUp>
            </li>
          </ul>
        </div>
      </section>
    </article>
  );
}
