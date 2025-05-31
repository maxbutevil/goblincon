
import { Mode } from "../mode"
import settings from "./settings"
import view from "./dating"
export { test } from "./dating"

const name = "Dating";
const desc = "Draw \"bachelors\", then pair them with \"suitors\" and vote for your favorite pairings!";
export default new Mode({
  name,
  desc,
  settings,
  view
});


