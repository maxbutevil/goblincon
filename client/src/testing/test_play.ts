import { h, s, Micron } from "../modules"
import { test } from "../play/play"

import { Countdown, BottomBar } from "../components";
test.nest(
  Micron.test("abstract")
    .add(Timers)
);
test.next();

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

Micron.mount(s(test));
