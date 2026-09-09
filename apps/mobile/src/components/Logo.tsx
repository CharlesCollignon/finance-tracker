import { Orb, type OrbProps } from "@/components/Orb";

export type LogoProps = OrbProps;

/** The brand mark is the orb, and nothing else. */
export function Logo(props: LogoProps) {
  return <Orb {...props} />;
}
