// Static image imports (`import photo from "./photo.jpg"`, as in
// lib/guide-covers.ts), typed the way next/image reads them. next-env.d.ts
// says the same, but `next build` writes it and git ignores it, so CI, which
// type-checks without building, needs it said here.
/// <reference types="next/image-types/global" />
