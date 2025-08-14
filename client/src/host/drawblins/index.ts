//export { default as default } from "./drawblins.ts"

import { Mode } from "../mode"
import settings from "./settings"
import view from "./drawblins"
export { test } from "./drawblins"

const name = "Drawing";
const desc = "Everyone draws a creature inspired by a randomly generated name, then votes for their favorites!";
export default new Mode({
  name,
  desc,
  settings,
  view
});


