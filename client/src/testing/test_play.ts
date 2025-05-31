import { h, s, Micron } from "../modules"
import { test } from "../play/play"

import { Countdown } from "../components";
import { BottomBar } from "../play/components";
test.nest(
  Micron.test("abstract")
    .add(Timers)
);

function Timers() {
  return h("div.scaffold", [
    h("div.primary-flow"),
    BottomBar({
      middle: [5, 10, 15, 20, 25].map((value) => (
        Countdown.fromSecs(value)
          .withPopups()
          .View()
      ))
    })
  ]);
}

Micron.mount(h("div#app", s(test)));