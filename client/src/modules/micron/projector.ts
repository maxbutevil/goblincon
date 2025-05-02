
//import State from "./state"
import Signal from "./signal"
import { Builder } from "./ctx"
import { h, VNode, } from "./snabbdom"

//type Blueprint<A extends any[]> = { builder: Builder<A>, args: A };
class Blueprint<A extends any[]> {
  builder: Builder<A>;
  args: A;
  constructor(builder: Builder<A>, args: A) {
    this.builder = builder;
    this.args = args;
  }
  build(): VNode {
    return this.builder(...this.args);
  }
};


//type Blueprint<A extends any[]> = [Builder<A>, A];
export const EMPTY_BUILDER: Builder<[]> = () => h("!");
export const EMPTY_BLUEPRINT = new Blueprint(EMPTY_BUILDER, []);

function bundled<A extends any[]>(builder: Builder<A>, args: A): Builder {
  if (args.length === 0) {
    return builder;
  } else {
    return () => builder(...args);
  }
}

/* Exposed constructors */
export function projector<A extends any[]>(initial: Builder<A> = EMPTY_BUILDER, ...initialArgs: A): Projector {
  return new Projector(bundled(initial, initialArgs));
}
export function anchor<A extends any[]>(initial: Builder<A> = EMPTY_BUILDER, ...initialArgs: A): Anchor {
  return new Anchor(new Blueprint(initial, initialArgs));
}
export function stack<A extends any[] = []>(initial?: (...args: A) => VNode, ...initialArgs: A): Stack {
  //return Stack.create(initialBuilder, initialArgs);
  return new Stack(!initial ? [] : [new Blueprint(initial, initialArgs)]);
}

export class Projector {
  
  readonly update = new Signal<[Builder]>();
  readonly initial: Builder;
  
  constructor(initialBuilder: Builder) {
    this.initial = initialBuilder;
  }
  put<A extends any[]>(builder: Builder<A>, ...builderArgs: A) {
    this.update.emit(bundled(builder, builderArgs));
  }
  clear() {
    this.update.emit(EMPTY_BUILDER);
  }
  reset() {
    this.update.emit(this.initial);
  }
}

export class Anchor {
  
  readonly update = new Signal<[Blueprint<any>]>();
  curr: Blueprint<any>;
  
  constructor(initial: Blueprint<any>) {
    this.curr = initial;
  }
  put<A extends any[]>(builder: (...args: A) => VNode, ...builderArgs: A) {
    this.curr = new Blueprint(builder, builderArgs);
    this.update.emit(this.curr);
  }
  clear() {
    this.put(EMPTY_BUILDER);
  }
  get() {
    return this.curr.builder;
  }
  is(builder: Builder): boolean {
    return this.curr.builder === builder;
  }
  any(...builders: Builder<any>[]): boolean {
    return builders.includes(this.curr.builder);
  }
}

export class Stack {
  
  readonly update = new Signal<[Blueprint<any>]>();
  blueprints: Blueprint<any>[];
  get curr() { return this.blueprints.at(-1) };
  
  //blueprints: Builder[] = [];
  constructor(blueprints: Blueprint<any>[]) {
    this.blueprints = blueprints;
  }
  private notify() {
    const blueprint = (this.blueprints.at(-1) ?? EMPTY_BLUEPRINT);
    this.update.emit(blueprint);
  }
  private add<A extends any[]>(builder: Builder<A>, builderArgs: A) {
    this.blueprints.push(new Blueprint(builder, builderArgs));
  }
  
  get count() {
    return this.blueprints.length;
  }
  top(): Builder | undefined {
    return this.blueprints.at(-1)?.builder;
  }
  root(): Builder | undefined {
    return this.blueprints.at(0)?.builder;
  }
  push<A extends any[]>(builder: Builder<A>, ...builderArgs: A) {
    this.add(builder, builderArgs);
    this.notify();
  }
  splice<A extends any[]>(builder: Builder<A>, ...builderArgs: A) {
    this.blueprints.pop();
    this.add(builder, builderArgs);
    this.notify();
  }
  pop() {
    if (this.blueprints.length > 0) {
      this.blueprints.pop();
      this.notify();
    }
  }
  clear<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A) {
    if (this.blueprints.length > 0) {
      this.blueprints = [];
    }
    if (initial) {
      this.add(initial, initialArgs);
    }
    this.notify();
  }
  
}


