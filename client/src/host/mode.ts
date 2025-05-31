

import { h, s } from "../modules/micron"
import * as Micron from "../modules/micron"
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

type PresetMap<M extends SettingMap> = { [key: string]: SettingMapRemote<M> }
//export type SettingsPreset<M extends SettingMap> = SettingMapRemote<M>;

export class Setting<const T> {
	
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
				const index = this.findString(stored);
				if (index >= 0) {
					this.current = index;
				} else {
					//localStorage.deleteItem(this.key);
				}
			}
		}
	}
	
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
	put(value: T) {
		const index = this.find(value);
		if (index < 0) {
			console.error("setting value not found:", this.key ?? this.name, value)
			return;
		}
		this.set(index);
	}
	
	find(value: T): number {
		return this.choices.findIndex(v => value === v);
	}
	findString(value: string): number {
		return this.choices.findIndex(v => value === this.stringifier(v));
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
	
	View(): Micron.Node {
		return h("div.setting-select", { key: this.name }, [
			h("div.name", {}, this.name),
			s(this.changed, () => {
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

export class Settings<M extends SettingMap, P extends PresetMap<M>> {
	
	map: M;
	presets: P;
	
	constructor(map: M, presets: P) {
		this.map = map;
		this.presets = presets;
	}
	
	get<K extends keyof M>(setting: K): SettingRemote<M[K]> {
		return this.map[setting].get();
	}
	reset() {
		for (const setting of Object.values(this.map))
			setting.reset();
	}
	put(map: SettingMapRemote<M>) {
		for (const key in map) {
			this.map[key].put(map[key]);
		}
	}
	remote(): SettingMapRemote<M> {
		const remote: { [key: string]: any } = {};
		for (const key in this.map)
			remote[key] = this.map[key].get();
		return remote as SettingMapRemote<M>;
	}
	
	*views(): Iterable<Micron.Node> {
		for (const setting of Object.values(this.map))
			yield setting.View();
	}
}
/*export class Presets<M extends SettingMap> {
	
}*/

type ModeOptions<S extends SettingMap, P extends PresetMap<S>> = {
	name: string,
	desc: string,
	settings: Settings<S, P>,
	view: Micron.Builder
};
export class Mode<S extends SettingMap, P extends PresetMap<S>> {
	
	readonly name: string;
	readonly desc: string;
	readonly settings: Settings<S, P>;
	readonly view: Micron.Builder;
	
	constructor({ name, desc, settings, view }: ModeOptions<S, P>) {
		this.name = name;
		this.desc = desc;
		this.settings = settings;
		this.view = view;
	}
	
	settingsRemote(): { mode: string, settings: SettingMapRemote<S> } {
		return { mode: this.name.toLowerCase(), settings: this.settings.remote() };
	}
	/*setting<K extends keyof S>(setting: K): SettingRemote<S[K]> {
		return this.settings.get(setting);
	}
	settingViews(): Iterable<Micron.Node> {
		return this.settings.views();
	}*/
	
}
