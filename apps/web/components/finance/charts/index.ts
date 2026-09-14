/**
 * The chart vocabulary: four marks, and not one of them costs a runtime.
 *
 * The app had drifted to five ways of drawing a chart — a charting library on
 * two screens, a hand-written donut on a third, CSS bars on a fourth, a
 * bespoke ring, and a Sankey — which meant five hover behaviours, five ways a
 * label could collide, and a runtime on some routes but not others.
 *
 *   BarSeries     one series over time     plain elements
 *   SpendStrip    a whole split as one bar plain elements
 *   ProgressRing  progress toward a limit  inline SVG
 *   Sparkline     the shape of a run       inline SVG
 *
 * There was a fifth: an ECharts line on Wallets, plotting a position's value
 * against what had been put into it. It went when the question changed. What
 * the holder wanted to know was what the *instrument* did, and that is a shape
 * and a percentage — a Sparkline on each row, with one range switch above
 * them. A charting library's weight buys hover, and hover was not the thing
 * missing.
 *
 * Sparkline is deliberately not one of the marks in the sense the others are —
 * it carries no scale and answers no question on its own. It exists to sit
 * beside a figure that does.
 */

export { BarSeries, type BarPoint } from "./BarSeries";
export { SpendStrip } from "./SpendStrip";
export { Sparkline } from "./Sparkline";
export { ProgressRing } from "../ProgressRing";
