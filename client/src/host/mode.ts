

import { h, signaled, VNode } from "../modules/micron";
import Signal from "../modules/signal"
//import * as Utils from "../utils"



type SettingRemote<S> = S extends Setting<infer T> ? T : never;
type SettingMap = { [key: string]: Setting<any> };
type SettingMapRemote<M extends SettingMap> = { [K in keyof M]: SettingRemote<M[K]> };

export class Setting<T = number> {
	
	changed = new Signal();
	
	name: string;
	choices: T[];
	initial: number;
	current: number;
	stringifier: (v: T) => string;
	
	constructor(name: string, choices: T[], initialIndex = Math.floor(choices.length/2), stringifier: ((v: T) => string) = (v => String(v))) {
		this.name = name;
		this.choices = choices;
		this.current = this.initial = initialIndex;
		this.stringifier = stringifier;
	}
	static multiplier(name: string, choices: number[], currentIndex = Math.floor(choices.length/2), precision = 1): Setting<number> {
		return new Setting(name, choices, currentIndex, (v) => Number(v).toFixed(precision) + "x")
	}
	static boolean(name: string, current = false): Setting<boolean> {
		let currentIndex = current ? 1 : 0;
		return new Setting(name, [false, true], currentIndex, (v) => v ? "Yes" : "No");
	}
	
	set(newCurrent: number) {
		if (this.current !== newCurrent) {
			this.current = newCurrent;
			this.changed.emit();
		}
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
					const tag = (i === this.current) ? "button.selected" : "button";
					return h(
						tag,
						{ on: { click: () => this.set(i) } },
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

export class Mode<S extends SettingMap> {
	
	name: string;
	settings: Settings<S>;
	
	view: () => VNode;
	
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
