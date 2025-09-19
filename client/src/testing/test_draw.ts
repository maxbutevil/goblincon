import "../play/play.scss";
import { h, Micron } from "../modules/index"
import Drawpad from "../play/drawpad";

const drawpad = new Drawpad({
  key: "testing-testing",
  onSubmit: () => {},
});

Micron.mount(h("div#drawpad-ctr", [
  drawpad.View()
]));