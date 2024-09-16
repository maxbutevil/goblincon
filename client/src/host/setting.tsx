

import Signal from "../modules/signal"
import * as Utils from "../utils"
import React from "react"

export type SettingsMap = { [key: string]: Setting<any> };
export type SettingsRemoteOf<M extends SettingsMap> = {
	[K in keyof M]: M[K] extends Setting<infer T> ? T : never };

export function toRemote<M extends SettingsMap>(settingsMap: M): SettingsRemoteOf<M> {
	const remote: { [key: string]: any } = {};
	for (const key in settingsMap)
		remote[key] = settingsMap[key].get();
	return remote as SettingsRemoteOf<M>;
}

export class Setting<T = number> {
	
	changed = new Signal();
	
	choices: T[];
	current: number;
	name: string;
	decorator: string;
	
	constructor(name: string, choices: T[], currentIndex = Math.floor(choices.length/2), decorator = "") {
		this.name = name;
		this.choices = choices;
		this.current = currentIndex;
		this.decorator = decorator;
	}
	set(newCurrent: number) {
		if (this.current !== newCurrent) {
			this.current = newCurrent;
			this.changed.emit();
		}
	}
	decrement() {
		if (this.current < 0)
			this.set(this.choices.length - 1);
		else
			this.set(this.current - 1);
	}
	increment() {
		this.set((this.current + 1) % this.choices.length);
	}
	get(): T {
		return this.choices[this.current];
	}
	getString(): string {
		return `${this.get()}${this.decorator}`;
	}
	
}

export function SettingSelect({ setting }: { setting: Setting<any> }) {
	
	Utils.useSignal(setting.changed);
	
	const onClick: React.MouseEventHandler = React.useCallback((event) => {
		let { left, right } = event.currentTarget.getBoundingClientRect();
		let middle = (left + right)/2;
		
		if (event.clientX > middle)
			setting.increment();
		else
			setting.decrement();
	}, []);
	
	return (
		<div className="setting-select" onClick={onClick}>
			{setting.name && <div className="name">{setting.name}</div>}
			<div className="setting">{setting.getString()}</div>
		</div>
	);
}
export function SettingMultiSelect({ settings }: { settings: SettingsMap }) {
	const selectors: JSX.Element[] = [];
	for (const key in settings)
		selectors.push(<SettingSelect key={key} setting={settings[key]} />);
	
	return <>{selectors}</>;
}


