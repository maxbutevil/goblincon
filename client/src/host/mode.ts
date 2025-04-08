

import { h, signaled, VNode } from "../modules/micron"
import Signal from "../modules/micron/signal"
//import * as Utils from "../utils"

type SettingRemote<S> = S extends Setting<infer T> ? T : never;
type SettingMap = { [key: string]: Setting<any> };
type SettingMapRemote<M extends SettingMap> = { [K in keyof M]: SettingRemote<M[K]> };
type SettingOptions<T> = {
	initial?: number,
	key?: string,
	stringifier?: (raw: T) => string,
};

export class Setting<T = number> {
	
	changed = new Signal();
	
	name: string;
	choices: T[];
	initial: number;
	current: number;
	stringifier: (v: T) => string;
	key?: string;
	
	constructor(name: string, choices: T[], options: SettingOptions<T> = {}) {
		this.name = name;
		this.choices = choices;
		this.key = options.key;
		this.stringifier = options.stringifier ?? ((v) => String(v));
		this.initial = options.initial ?? Math.floor(this.choices.length/2);
		
		this.current = this.initial;
		if (this.key) {
			const stored = localStorage.getItem(this.key);
			if (stored) {
				const index = this.find(stored);
				if (index !== undefined) {
					this.current = index;
				} else {
					//localStorage.deleteItem(this.key);
				}
			}
		}
	}
	
	
	/*constructor(name: string, choices: T[], initialIndex = Math.floor(choices.length/2), stringifier: ((v: T) => string) = (v => String(v))) {
		this.name = name;
		this.choices = choices;
		this.current = this.initial = initialIndex;
		this.stringifier = stringifier;
	}*/
	static multiplier(name: string, choices: number[], { initial, key, precision }: { initial?: number, key?: string, precision?: number } = {}): Setting<number> {
		const stringifier = ((v: number) => Number(v).toFixed(precision ?? 1) + "x");
		return new Setting(name, choices, { initial, key, stringifier });
	}
	static boolean(name: string, { initial, key, trueLabel, falseLabel }: { initial?: boolean, key?: string, trueLabel?: string, falseLabel?: string } = {}): Setting<boolean> {
		const stringifier = ((v: boolean) => v ? (trueLabel ?? "Yes") : (falseLabel ?? "No"));
		return new Setting(name, [false, true], {
			initial: initial === true ? 1 : 0,
			key,
			stringifier
		});
	}
	
	set(newCurrent: number) {
		if (this.current !== newCurrent) {
			this.current = newCurrent;
			if (this.key) {
				try {
					localStorage.setItem(this.key, this.getString());
				} catch(e) { console.error(e); }
			}
			this.changed.emit();
		}
	}
	find(value: string): number | undefined {
		for (let i = 0; i < this.choices.length; i++) {
			if (this.getString(i) === value) {
				return i;
			}
		}
		return undefined;
	}
	reset() {
		this.set(this.initial);
	}
	decrement() {
		if (this.current <= 0)
			this.set(this.choices.length - 1);
		else
			this.set(this.current - 1);
	}
	increment() {
		this.set((this.current + 1) % this.choices.length);
	}
	get(i = this.current): T {
		return this.choices[i];
	}
	getString(i = this.current): string {
		return this.stringifier(this.get(i));
	}
	
	view(): VNode {
		return h("div.setting-select", { key: this.name }, [
			h("div.name", {}, this.name),
			signaled(this.changed, () => {
				return h("div.multi-btn", this.choices.map((_, i) => {
					return h(
						"button",
						{
							on: { click: () => this.set(i) },
							class: { selected: i === this.current }
						},
						this.getString(i)
					);
				}));
			})
		]);
	}
}

export class Settings<M extends SettingMap> {
	
	map: M;
	constructor(map: M) {
		this.map = map;
	}
	
	get<K extends keyof M>(setting: K): SettingRemote<M[K]> {
		return this.map[setting].get();
	}
	reset() {
		for (const setting of Object.values(this.map))
			setting.reset();
	}
	remote(): SettingMapRemote<M> {
		const remote: { [key: string]: any } = {};
		for (const key in this.map)
			remote[key] = this.map[key].get();
		return remote as SettingMapRemote<M>;
	}
	
	*views(): Iterable<VNode> {
		for (const setting of Object.values(this.map))
			yield setting.view();
	}
}

/*export class Mode<S extends SettingMap> {
	name: string;
	settings: Settings<S>;
	
	View: () => VNode;
	Recap?: () => VNode;
}*/

export class Mode<S extends SettingMap> {
	
	name: string;
	settings: Settings<S>;
	
	view: () => VNode;
	//recapView?: () => VNode;
	
	constructor(name: string, view: () => VNode, settingMap: S) {
		this.name = name;
		this.settings = new Settings(settingMap);
		this.view = view;
	}
	setting<K extends keyof S>(setting: K): SettingRemote<S[K]> {
		return this.settings.get(setting);
	}
	settingViews(): Iterable<VNode> {
		return this.settings.views();
	}
	remote(): { mode: string, settings: SettingMapRemote<S> } {
		return { mode: this.name, settings: this.settings.remote() };
	}
}
