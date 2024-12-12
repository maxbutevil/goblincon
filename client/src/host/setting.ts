

import { h, fragment, conditional, signaled, VNode } from "../modules/render";
import Signal from "../modules/signal"
//import * as Utils from "../utils"

export type SettingsMap = { [key: string]: Setting<any> };
export type SettingsRemoteOf<M extends SettingsMap> = {
	[K in keyof M]: M[K] extends Setting<infer T> ? T : never };

export function toRemote<M extends SettingsMap>(settingsMap: M): SettingsRemoteOf<M> {
	const remote: { [key: string]: any } = {};
	for (const key in settingsMap)
		remote[key] = settingsMap[key].get();
	return remote as SettingsRemoteOf<M>;
}

export default class Setting<T = number> {
	
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
	
	static view(setting: Setting<any>): VNode {
		return h("div.setting-select", { key: setting.name }, [
			h("div.name", {}, setting.name),
			signaled(setting.changed, () => {
				let choices = [];
				for (let i = 0; i < setting.choices.length; i++) {
					
					let tag = (i == setting.current) ? "button.selected" : "button";
					
					choices.push(h(
						tag,
						{
							on: {
								click: () => setting.set(i)
							}
						},
						setting.getString(i)
					));
				}
				return h("div.multi-btn", choices);
			})
		]);
	}
	static multiView(settings: SettingsMap): VNode {
		let nodes = [];
		for (const key in settings)
			nodes.push(this.view(settings[key]));
		return fragment(nodes);
	}
}


