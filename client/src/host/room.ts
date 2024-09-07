

import Signal from "../modules/signal"
import State from "../modules/state"
import { Enum, Variant } from "../modules/variant"
import Extract, { ReceiveIndex, SendIndex } from "../modules/extract"

export class Player {
	public name: string;
	constructor(name: string) {
		this.name = name;
	}
}

export const playerJoined = new Signal<{ playerId: number, player: Player }>();
export const playerLeft = new Signal<{ playerId: number, player: Player }>()

export let joinCode = "";
export let players: Player[] = [];

export function handlePlayerJoined(playerId: number, playerName: string) {
	const player = new Player(playerName);
	players[playerId] = player;
	playerJoined.emit({ playerId, player });
}
export function handlePlayerLeft(playerId: number) {
	const player = players[playerId];
	delete players[playerId];
	playerLeft.emit({ playerId, player });
}

export function playerName(id: number): string | undefined {
	return players[id].name;
}
export function playerIds(): number[] {
	return Array.from(players.keys());
}
export function setJoinCode(code: string) {
	joinCode = code;
}
export function getJoinCode(): string {
	return joinCode;
}

//type Settings = { [key: string]: }

//type Settings = { [key: string]: State<any> };

/*export class Room {
	
	static readonly playerJoined = new Signal<{ playerId: number, player: Player }>();
	static readonly playerLeft = new Signal<{ playerId: number, player: Player }>();
	
	static joinCode: string = "";
	static players: Player[] = [];
	
	static setJoinCode(code: string) {
		this.joinCode = code;
	}
	static handlePlayerJoined(playerId: number, playerName: string) {
		const player = new Player(playerName);
		this.players[playerId] = player;
		this.playerJoined.emit({ playerId, player });
	}
	static handlePlayerLeft(playerId: number) {
		const player = this.players[playerId];
		delete this.players[playerId];
		this.playerLeft.emit({ playerId, player });
	}
}*/







