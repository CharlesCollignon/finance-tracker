// Next.js extends fetch's RequestInit with a `next` caching option. Declared
// here so this package typechecks outside a Next.js app; the option still
// takes effect when the code runs inside one and is ignored elsewhere.
interface RequestInit {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}
