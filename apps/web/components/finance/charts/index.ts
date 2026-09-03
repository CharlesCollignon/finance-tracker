/**
 * The chart vocabulary: four marks, and only one of them costs a runtime.
 *
 * The app had drifted to five ways of drawing a chart — a charting library on
 * two screens, a hand-written donut on a third, CSS bars on a fourth, a
 * bespoke ring, and a Sankey — which meant five hover behaviours, five ways a
 * label could collide, and a runtime on some routes but not others.
 *
 *   BarSeries     one series over time     plain elements
 *   SpendStrip    a whole split as one bar plain elements
 *   ProgressRing  progress toward a limit  inline SVG
 *   line          a dense time series      ECharts, on Wallets alone
 *
 * The first three render on the server and weigh nothing. The fourth earns
 * its weight: hovering a holding's price over two years is a real interaction
 * that hand-drawn marks cannot give.
 */

export { BarSeries, type BarPoint } from "./BarSeries";
export { SpendStrip } from "./SpendStrip";
export { ProgressRing } from "../ProgressRing";
