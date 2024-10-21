

import Signal from "../modules/signal"
import State from "../modules/state"
import { Variant, unit, variant } from "../modules/variant"
import Validate, { ReceiveIndex, SendIndex } from "../modules/validate"
import client from "../modules/client"
import * as Shared from "../modules/shared"



export const playerJoined = new Signal<{ playerId: number, player: Player }>();
export const playerLeft = new Signal<{ playerId: number, player: Player }>()
export const playerIconChanged = new Signal<{ playerId: number, player: Player }>();

export let joinCode = "";
export let players: Player[] = [];

export function playerCount(): number {
	return playerIds().length;
}
export function playerName(id: number): string | undefined {
	return players[id].name;
}
export function playerIcon(id: number): number {
	return players[id].icon;
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

const INC = new ReceiveIndex({
	"accepted": { joinCode: Validate.STRING },
	"playerJoined": { playerId: Validate.NUMBER, name: Validate.STRING, icon: Validate.NUMBER },
	"playerLeft": { playerId: Validate.NUMBER },
	"playerIconChanged": { playerId: Validate.NUMBER, icon: Validate.NUMBER }
});
const OUT = new SendIndex({
	
});

client.use(INC, OUT);
INC.listen("accepted", ({ joinCode }) => setJoinCode(joinCode));
INC.listen("playerJoined", ({ playerId, name, icon }) => {
	const player = new Player(playerId, name, icon);
	players[playerId] = player;
	playerJoined.emit({ playerId, player });
});
INC.listen("playerLeft", ({ playerId }) => {
	const player = players[playerId];
	delete players[playerId];
	playerLeft.emit({ playerId, player });
});
INC.listen("playerIconChanged", ({ playerId, icon }) => {
	const player = players[playerId];
	player.icon = icon;
	playerIconChanged.emit({ playerId, player });
});
client.disconnected.listen(() => {
	joinCode = "";
	players = [];
});

export class Player {
	public id: number;
	public name: string;
	public icon: number;
	get color() { return Shared.playerColor(this.id); }
	constructor(id: number, name: string, icon: number) {
		this.id = id;
		this.name = name;
		this.icon = icon;
	}
}
