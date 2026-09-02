import { Orb, type OrbProps } from "@/components/Orb";

export type LogoProps = OrbProps;

/** The brand mark is the orb, still: it is lit from a fixed point. */
export function Logo(props: LogoProps) {
  return <Orb {...props} />;
}
