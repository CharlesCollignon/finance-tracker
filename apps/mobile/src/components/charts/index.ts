/**
 * The chart vocabulary: four marks, and only one of them costs a runtime.
 *
 * The same four the web app draws, so a screen described in one place looks
 * the way it is described in the other:
 *
 *   BarSeries     one series over time     plain views
 *   SpendStrip    a whole split as one bar plain views
 *   ProgressRing  progress toward a limit  react-native-svg
 *   line          a dense time series      ECharts, on Wallets alone
 *
 * The mobile app had drifted the same way the web one had — a donut, a
 * Sankey, a trend chart and a hand-drawn ring, three of them pulling in a
 * charting runtime to draw shapes that a few views can draw for nothing.
 */

export { BarSeries, type BarPoint } from "./BarSeries";
export { SpendStrip } from "./SpendStrip";
export { ProgressRing } from "./ProgressRing";
