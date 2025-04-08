
import State from "./state"
import Signal from "./signal"
import { Builder } from "./ctx"
import { h, VNode, } from "./snabbdom"

const EMPTY_BUILDER = () => h("!");

/* Exposed constructors */
export function projector<A extends any[]>(initialBuilder: (...args: A) => VNode, ...initialArgs: A) {
  return Projector.create(initialBuilder, initialArgs);
}
export function navigator<A extends any[]>(initialBuilder: (...args: A) => VNode, ...initialArgs: A) {
  return Nav.create(initialBuilder, initialArgs);
}

export class Projector {
  
  readonly signal = new Signal<[Builder]>();
  readonly initial: Builder;
  
  private constructor(initialBuilder: Builder) {
    this.initial = initialBuilder;
  }
  static create<A extends any[]>(initialBuilder: (...args: A) => VNode, initialArgs: A): Projector {
    if (initialArgs.length === 0) {
      return new Projector(initialBuilder);
    } else {
      return new Projector(() => initialBuilder(...initialArgs));
    }
  }
  
  put<A extends any[]>(builder: (...args: A) => VNode, ...builderArgs: A) {
    if (builderArgs.length === 0) {
      this.signal.emit(builder);
    } else {
      this.signal.emit(() => builder(...builderArgs));
    }
  }
  clear() {
    this.signal.emit(EMPTY_BUILDER);
  }
  reset() {
    this.signal.emit(this.initial);
  }
}
export class Nav {
  
  readonly state: State<Builder>;
  
  constructor(initialBuilder: Builder) {
    this.state = new State(initialBuilder);
  }
  static create<A extends any[]>(initialBuilder: (...args: A) => VNode, initialArgs: A): Nav {
    if (initialArgs.length === 0) {
      return new Nav(initialBuilder);
    } else {
      return new Nav(() => initialBuilder(...initialArgs));
    }
  }
  
  put<A extends any[]>(builder: (...args: A) => VNode, ...builderArgs: A) {
    if (builderArgs.length === 0) {
      this.state.set(builder);
    } else {
      this.state.set(() => builder(...builderArgs));
    }
  }
  clear() {
    this.state.set(EMPTY_BUILDER);
  }
}