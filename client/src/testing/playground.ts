
import "./test.scss"

import {
  h, s, c, Micron
} from "../modules/index"

import { NameOverlay } from "../play/components"
import Drawpad from "../play/drawpad"
import { playerIcons } from "../modules/index"
import { SubmissionData } from "../modules/data"

import * as icons from "../assets/icons"
import * as testAssets from "../assets/testing"



class Nav extends Micron.Anchor {
  
  /*IconBtn(src: string, builder: Micron.Builder) {
    
  }*/
  
  Btn(src: string, builder: Micron.Builder) {
    return s(this.changed, curr => {
      const click = () => this.toggle(builder);
      const selected = this.is(builder);
      return h("div.btn",
        { class: { selected }, on: { click } },
        h("img", { attrs: { src } }),
      );
    });
  }
}




/*class Nav extends Micron.Anchor {
  
  buttons: [string, Micron.Builder][];
  constructor(buttons: [string, Micron.Builder][], initial = 0) {
    super();
    this.put(buttons[initial][1]);
    this.buttons = buttons;
  }
  
  View() {
    return s(this.changed, (curr) => {

      const Btn = ([src, builder]: [string, Micron.Builder]) => {
        const click = () => this.put(builder);
        const selected = this.is(builder);
        return h("div.btn",
          { class: { selected }, on: { click } },
          h("img", { attrs: { src } }),
        );
      };
      
      return h("div#nav", this.buttons.map(Btn));
    });

    //return h("div#nav", this.buttons.map(Btn));
  }
}*/


type NavBtnData = [string, Micron.Builder];

type TopBarOptions = {
  title?: string,
  left?: Micron.Children,
  right?: Micron.Children,
};
type BottomBarOptions = {
  countdown?: Countdown,
  left?: Micron.Children,
  right?: Micron.Children
};
function TopBar({ title, left, right }: TopBarOptions) {
  return h("div#top-bar", [
    h("div.left", left),
    h("div.middle", h("div.title", title)),
    h("div.right", right),
  ]);
}
function BottomBar({ countdown, left, right }: BottomBarOptions) {
  return h("div#bottom-bar", [
    h("div.left", left),
    h("div.middle", countdown?.View()),
    h("div.right", right)
  ]);
}



class Countdown {
  
  private remainingSecs = new Micron.State(NaN);
  //private popupSecs = new Micron.State(NaN);
  private callbacks: Array<{ time: number, callback: () => any }> = [];
  private interval: number;
  private popupThresholds?: number[];
  
  constructor(endTime: number) {
    const tick = () => {
      let delta = endTime - Date.now() - 50;
      let newSeconds = Math.ceil(delta/1000);
      
      if (newSeconds <= 0) {
        newSeconds = 0;
        clearInterval(this.interval);
      }
      
      for (let i = this.callbacks.length - 1; i >= 0; i--) {
        const { time, callback } = this.callbacks[i];
        if (newSeconds <= time) {
          callback();
          this.callbacks.splice(i, 1);
        }
      }
      
      this.remainingSecs.set(newSeconds);
    };
    
    //this.popupThresholds = Countdown.calculatePopupThresholds(endTime);
    this.interval = setInterval(tick, 50);
    Micron.tryDefer(() => clearInterval(this.interval));
    tick();
  }
  private static calculatePopupThresholds(secsLeft: number) {
    secsLeft += 0.5;
    if (secsLeft >= 180) return [10, 30, 60, 120];
    if (secsLeft >=  90) return [10, 30, 60];
    if (secsLeft >=  45) return [10, 30];
    if (secsLeft >=  12) return [10];
    return [];
  }
  private static calculateEnd(secsLeft: number, secsBuffer = 0): number {
    return Date.now() + 1000 * (secsLeft - secsBuffer);
  }
  static fromSecs(secsLeft: number, secsBuffer = 0): Countdown {
    return new Countdown(Countdown.calculateEnd(secsLeft, secsBuffer));
  }
  static Simple(endTime: number, onFinish?: () => void): Micron.Node {
    const cd = new Countdown(endTime);
    if (onFinish) cd.onFinish(onFinish);
    return cd.View();
  }
  static Secs(secsLeft: number, secsBuffer = 0, onFinish?: () => void): Micron.Node {
    const cd = this.fromSecs(secsLeft, secsBuffer);
    if (onFinish) cd.onFinish(onFinish);
    return cd.View();
  }
  
  stop() {
    this.remainingSecs.set(-1);
    clearInterval(this.interval);
  }
  withPopups() {
    this.popupThresholds = Countdown.calculatePopupThresholds(this.remainingSecs.get());
  }
  onThreshold(time: number, callback: () => any): Countdown {
    this.callbacks.push({ time, callback });
    return this;
  }
  onFinish(callback: () => any): Countdown {
    return this.onThreshold(0, callback);
  }
  
  private getPopupValue(curr: number): number {
    
    if (this.popupThresholds === undefined || curr <= 0) {
      return NaN;
    }
    if (curr >= 1 && curr <= 3)
      return curr;
    
    for (const threshold of this.popupThresholds)
      if (curr <= threshold)
        return threshold;
    
    return NaN;
  }
  private Popup(curr: number) {
    const value = this.getPopupValue(curr);
    const final = value <= 3;
    const key = final ? "final" : value;
    
    if (isNaN(value)) {
      return h("!");
    } else {
      return h("div.countdown-popup",
        { key, class: { final } },
        value //`${value}${final ? "!" : ""}`
      );
    }
  }
  View(): Micron.Node {
    
    /*const popup = s(this.popupSecs, (curr) => {
      if (isNaN(curr)) {
        return h("!");
      } else {
        return h("div.countdown-popup", { key: curr }, curr);
      }
    });*/

    return s(this.remainingSecs, (curr) => {
      
      if (curr < 0) {
        return h("div.countdown", "");
      } else {
        const color = "black";
        //const color = (curr >= 1 && curr <= 3) ? "red" : "black";
        return h("div.countdown", { style: { color } }, [
          curr.toString(),
          this.Popup(curr)
        ]);
      }
    });
  }
}


type DrawStageOptions = {
  
  naming?: NameOverlay,
  
  secsLeft?: number,
  secsBuffer?: number,
  //endTime?: number,
  //endBuffer?: number,
  //countdown?: Countdown,
  bachelorData?: SubmissionData
};
export class DrawStage {

  readonly submitted = new Micron.Signal<[SubmissionData]>();
  readonly naming?: NameOverlay;
  readonly countdown?: Countdown;
  readonly bachelorData?: SubmissionData;
  
  constructor({ naming, secsLeft, secsBuffer, bachelorData }: DrawStageOptions) {
    //this.options = options;
    this.naming = this.naming;
    this.bachelorData = bachelorData;
    if (secsLeft !== undefined) {
      this.countdown = Countdown.fromSecs(secsLeft, secsBuffer ?? 0);
    }
  }
  View() {
    
  }

}



Micron.mount(App());
function App() {
  
  const nav = new Nav();
  const drawpad = new Drawpad({ onSubmit: () => { } });
  const countdown = Countdown.fromSecs(5);
  const nameOverlay = new NameOverlay({ onClose: close });
  
  function close() { nav.clear(); }
  function Name() { return nameOverlay.View(); }
  function Bachelor() { return BachelorOverlay(close); }
  function Help() {
    return h("div#overlay",
      h("div#help-popup", [
        h("h2", "Help: Suitor Drawing"),
        h("div", "Use this time to draw your suitor!"),
        h("div", [
          "You have been given another player's bachelor drawing as inspiration. ",
          "Draw something that pairs well with it!",
        ]),
        //h("div.example", []),
        h("div", [
          h("b", "Note: "),
          "You do ",
          h("em", "not "),
          "need to follow the bachelor theme. Draw whatever you like!"
        ]),
        h("button", { on: { click: close } }, "Done")
        //h("div", "Use it to ")
      ])
    )
  }
  
  Micron.tryDefer(
    Micron.Signal.keydown.subscribe((ev) => {
      if (ev.key === 'Escape' || ev.key === 'Enter') {
        nav.clear();
      }
    })
  );
  
  return h("div#app", [
    TopBar({
      title: "Draw a Suitor!",
      right: playerIcons.View(1, 'red')
    }),
    h("div#drawpad-ctr.flow.mount", [
      //h("h2", "Draw your suitor!"),
      drawpad.View(),
      s(nav),
    ]),
    BottomBar({
      countdown,
      left: [
        nav.Btn(icons.name, Micron.builder.EMPTY),
        nav.Btn(icons.name, Name),
        nav.Btn(icons.bachelor, Bachelor)
      ],
      right: [
        nav.Btn(icons.help, Help)
      ],
    }),
    //BottomBar({ nav, countdown })
  ]);
}
function BachelorOverlay(close: () => void) {
  
  const bachelorSubmission = {
    name: "Pants",
    drawing: testAssets.legsLord
  };
  
  const { name, drawing } = bachelorSubmission;
  
  return h("div#overlay", [
    h("div#bachelor-popup", [
      h("div", [
        h("h2", "Your Bachelor(ette)"),
        h("div",
          { style: { fontSize: "0.86em" } },
          "Use this as inspiration for your suitor drawing!"
        ),
      ]),
      h("div#bachelor-ctr", [
        c(name && h("div#bachelor-name", name)),
        h("img#bachelor-img",
          {
            attrs: {
              src: drawing,
              width: 360,
              height: 360
            }
          }
        ),
      ]),
      h("button",
        { on: { click: close } },
        "Start Drawing!"
      )
    ])
  ]);
}


function IconBtn() {
  return h("div", [
    
  ]);
}

