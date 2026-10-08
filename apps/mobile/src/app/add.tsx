import { Redirect } from "expo-router";

/**
 * `pluclair://add`, what the home-screen quick action « Ajouter une dépense »
 * opens: Le point, with the add sheet over it. The sheet lives with the tabs
 * (`QuickAddProvider`), so this only passes the wish on as `?add=1`.
 */
export default function AddLink() {
  return <Redirect href={{ pathname: "/", params: { add: "1" } }} />;
}
