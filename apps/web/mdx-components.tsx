import type { MDXComponents } from "mdx/types";
import { Calc } from "@/components/marketing/blog/Calc";
import {
  Aside,
  Envelopes,
  InPluclair,
  Sources,
  Step,
  Steps,
} from "@/components/marketing/blog/kit";
import {
  A,
  H2,
  H3,
  Hr,
  Ol,
  P,
  Strong,
  Ul,
} from "@/components/marketing/blog/prose";
import { Term } from "@/components/marketing/blog/Term";

/**
 * What a guide's MDX is drawn with (`content/guides/`): its Markdown in the
 * site's own type and greys, and the components a guide may use without
 * importing them. Required by `@next/mdx` with the App Router.
 */
const components: MDXComponents = {
  h2: H2,
  h3: H3,
  p: P,
  a: A,
  ul: Ul,
  ol: Ol,
  strong: Strong,
  hr: Hr,
  Aside,
  Calc,
  Envelopes,
  InPluclair,
  Sources,
  Step,
  Steps,
  Term,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
