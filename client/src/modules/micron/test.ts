
import { Builder } from "./builder"
import { Blueprint } from "./blueprint"
import * as blueprint from "./blueprint"
import Signal from "./signal"

type SetupTeardown = {
  setup?: () => void,
  teardown?: () => void
};


export function test(key: string): Test {
  return new Test(key);
}

/*export class TestBuilder {
  readonly key: string;
  readonly children: (Test | TestBuilder | Blueprint)[] = [];
  protected setups: (() => void)[] = [];
  protected teardowns: (() => void)[] = [];
  
  
}*/
export class Test {
  
  readonly key: string;
  readonly children: (Test | Blueprint)[] = [];
  protected creates?: (() => void)[];
  protected destroys?: (() => void)[];
  protected setups?: (() => void)[];
  protected teardowns?: (() => void)[];
  
  readonly changed = new Signal();
  protected index?: number;
  
  get count() {
    return this.children.length;
  }
  
  constructor(key: string) {
    this.key = key;
  }
  
  add<A extends any[]>(builder: Builder<A>, ...args: A): Test {
    this.children.push([builder, args]);
    return this;
  }
  nest(test: Test): Test {
    this.children.push(test);
    return this;
  }
  
  create(callback: () => void): Test {
    (this.creates ??= []).push(callback);
    return this;
  }
  destroy(callback: () => void): Test {
    (this.destroys ??= []).push(callback);
    return this;
  }
  setup(callback: () => void): Test {
    (this.setups ??= []).push(callback);
    return this;
  }
  teardown(callback: () => void): Test {
    (this.teardowns ??= []).push(callback);
    return this;
  }
  
  private static runCallbacks(callbacks?: (() => void)[]) {
    if (callbacks)
      for (const callback of callbacks)
        callback();
  }
  handleCreate() {
    Test.runCallbacks(this.creates);
    for (const child of this.children)
      if (child instanceof Test) child.handleCreate();
    this.handleSetup();
  }
  handleDestroy() {
    this.handleTeardown();
    for (const child of this.children)
      if (child instanceof Test) child.handleDestroy();
    Test.runCallbacks(this.destroys);
  }
  handleSetup() {
    Test.runCallbacks(this.setups);
    const child = this.getChild();
    if (child instanceof Test) child.handleSetup();
  }
  handleTeardown() {
    const child = this.getChild();
    if (child instanceof Test) child.handleTeardown();
    Test.runCallbacks(this.teardowns);
  }
  
  private load(): number {
    if (this.count === 0) {
      console.error("loading test that has no children");
      return 0;
    }
    
    try {
      const stored = sessionStorage.getItem(this.key);
      if (stored !== null) {
        let parsed = parseInt(stored) || 0; // clears NaN
        if (parsed < 0 || parsed >= this.count) {
          console.warn("test index out of bounds");
          return 0;
        }
        return parsed;
      }
    } catch (err) {
      console.error("error loading test:", err);
    }
    return 0;
  }
  getIndex(): number {
    return (this.index ??= this.load());
  }
  getChild(): Test | Blueprint {
    return this.children[this.getIndex()];
  }
  getBlueprint(): Blueprint {
    const child = this.getChild();
    if (child instanceof Test) {
      return child.getBlueprint();
    } else {
      return child;
    }
  }
  getNavString(): string {
    const child = this.getChild();
    if (child instanceof Test) {
      return this.key + "/" + child.getNavString();
    } else {
      return this.key + ":" + this.index;
    }
  }
  /*getNode(): VNode {
    return blueprint.build(this.getBlueprint());
  }*/
  private setIndex(index: number) {
    if (this.count === 0) {
      console.warn("attempted to update Test that has no components");
      return;
    }
    
    if (index < 0) {
      index = this.count - 1;
    } else if (index >= this.count) {
      index = 0;
    }
    
    if (this.index === index) {
      return;
    }
    
    if (this.index !== undefined) {
      const child = this.getChild();
      if (child instanceof Test)
        child.handleTeardown();
    }
    
    this.index = index;
    try {
      sessionStorage.setItem(this.key, this.index!.toString());
    } catch (err) {
      console.error("error storing test:", err);
    }
    //console.info(`[${this.key}/${this.index}]`);
    
    
    const child = this.getChild();
    if (child instanceof Test)
      child.handleSetup();
  }
  
  /*isAtFirst() {
    return this.getIndex() <= 0;
  }
  isAtLast() {
    return this.getIndex() >= this.count - 1;
  }*/
  
  next() {
    const child = this.getChild();
    if (child instanceof Test && child.getIndex() < child.count - 1) {
      child.next();
      this.changed.emit();
    } else {
      this.setIndex(this.getIndex() + 1);
      const child = this.getChild();
      if (child instanceof Test) {
        child.setIndex(0);
      }
      this.changed.emit();
    }
  }
  prev() {
    const child = this.getChild();
    if (child instanceof Test && child.getIndex() > 0) {
      child.prev();
      this.changed.emit();
    } else {
      this.setIndex(this.getIndex() - 1);
      const child = this.getChild();
      if (child instanceof Test) {
        child.setIndex(child.count - 1);
      }
      this.changed.emit();
    }
  }
}



/*class TestSuiteBuilder {
  readonly key?: string;
  readonly tests: Test[] = [];
}
class TestSuite {
  static instance = new TestSuite();
  
  readonly key?: string;
  readonly tests: Test[] = [];
  protected setup?: () => void;
  protected teardown?: () => void;
}*/
/*
class TestBuilder {
  readonly builders: (() => Test)[];
}
class TestSuiteBuilder {
  readonly key?: string;
  readonly builders: (() => Test)[] = [];
  protected setups: (() => void)[] = [];
  protected teardowns: (() => void)[] = [];
  
  constructor({ setup, teardown }: SetupTeardown) {
    if (setup) this.setups.push(setup);
    if (teardown) this.teardowns.push(teardown);
  }
  add(key: string, inner: (test: Test) => void) {
    this.builders.push(Test.builder(key, inner));
  }
  setup(callback: () => void) {
    this.setups.push(callback);
  }
  teardown(callback: () => void) {
    this.teardowns.push(callback);
  }
  init(): TestSuite {
    const tests = this.builders.map(b => b());
    const setup = this.setups.length === 0 ? undefined : Signal.bundle(...this.setups);
    const teardown = this.teardowns.length === 0 ? undefined : Signal.bundle(...this.teardowns);
    
    const suite = new TestSuite(this.key, tests, {
      
    });
  }
}

class TestBuilder {
  readonly key?: string;
  readonly builders: (() => Test)[] = [];
  protected setups: (() => void)[] = [];
  protected teardowns: (() => void)[] = [];
  
}


class TestSuite {
  readonly key: string;
  readonly tests: Test[] = [];
  protected setup?: (() => void);
  protected teardown?: (() => void);
  
  constructor(key: string, tests: Test[], setups: ) {
    this.key = key;
    this.tests = tests;
  }
}

class TestBuilder {
  readonly builders: (() => Test)[];
}
class Test {
  readonly key?: string;
  readonly builders: (TestBuilder[] | Builder)[];
  readonly blueprints: Builder[] = [];
  protected setup?: () => void;
  protected teardown?: () => void;
}

class Test {
  
  static builder(key: string, inner: (test: Test) => void) {
    function build() {
      const test = new Test(key);
      inner(test);
      if (test.count === 0) {
        console.warn("[Micron] built Test that has no components");
      }
      return test;
    }
    return build;
  }
  
  protected constructor(key: string) {
    this.key = key;
    const stored = sessionStorage.getItem(this.key);
    if (stored !== null) {
      this.index = parseInt(stored) || 0;
    }
  }
  
  readonly key?: string;
  readonly blueprints: Blueprint[] = [];
  protected setup?: () => void;
  protected teardown?: () => void;
  
  readonly changed = new Signal();
  protected index = 0;
  
  get count() {
    return this.blueprints.length;
  }
  
  add<A extends any[]>(builder: Builder<A>, ...args: A) {
    this.blueprints.push([builder, args]);
  }
  set(index: number) {
    if (this.count === 0) {
      //console.warn("[Micron] attempted to update Test that has no components");
      return;
    }
    
    if (index < 0) {
      index = this.count - 1;
    } else if (index >= this.count) {
      index = 0;
    }
    
    if (this.index !== index) {
      this.index = index;
      if (this.key !== undefined) {
        try {
          sessionStorage.setItem(this.key, this.index.toString());
        } catch (err) {
          console.error("sessionStorage error:", err);
        }
      }
      console.info(`[${this.key}/${this.index}]`);
      this.changed.emit();
    }
  }
  next() {
    this.set(this.index + 1);
  }
  prev() {
    this.set(this.index - 1);
  }
  
  build() {
    if (this.blueprints.length === 0) {
      console.warn("[Micron] built Test that has no components");
      return blueprint.build(blueprint.EMPTY);
    }
    return blueprint.build(this.blueprints[this.index]);
  }
}
*/



