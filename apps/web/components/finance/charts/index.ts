/**
 * The chart vocabulary: five marks, and only one of them costs a runtime.
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
 *   line          a dense time series      ECharts, on Wallets alone
 *
 * The first four render on the server and weigh nothing. The fifth earns its
 * weight: hovering a holding's price over two years is a real interaction
 * that hand-drawn marks cannot give.
 *
 * Sparkline is deliberately not one of the four marks in the sense the others
 * are — it carries no scale and answers no question on its own. It exists to
 * sit beside a figure that does.
 */

export { BarSeries, type BarPoint } from "./BarSeries";
export { SpendStrip } from "./SpendStrip";
export { Sparkline } from "./Sparkline";
export { ProgressRing } from "../ProgressRing";
