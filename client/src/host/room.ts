
import {
	Signal, State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex,
	client,
	Shared,
	PlayerIcons,
	h
} from "../modules/index"


export const playerJoined = new Signal<Player>();
export const playerLeft = new Signal<Player>()
export const playerIconChanged = new Signal<Player>();

export let joinCode = "";
//export let players: Player[] = [];
export let players: Map<number, Player> = new Map();

export function setJoinCode(code: string) {
	joinCode = code;
}
export function getJoinCode(): string {
	return joinCode;
}

export function playerCount() {
	return players.size;
}
export function hasPlayer(id: number): boolean {
	return players.has(id);
}
export function player(id: number): Player | undefined {
	return players.get(id);
}
/*export function playerName(id: number): string | undefined {
	return player(id)?.name;
}
export function playerIcon(id: number): number {
	return players[id].icon;
}*/
export function playerIds(): IterableIterator<number> {
	return players.keys();
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
	players.set(playerId, player);
	playerJoined.emit(player);
});
INC.listen("playerLeft", ({ playerId }) => {
	const player = players.get(playerId);
	if (player === undefined) {
		console.warn("Received playerLeft for player that is not present.");
	} else {
		players.delete(playerId);
		playerLeft.emit(player);
	}
});
INC.listen("playerIconChanged", ({ playerId, icon }) => {
	const player = players.get(playerId);
	if (player === undefined) {
		console.warn("Received playerIconChanged for player that is not present.");
	} else {
		player.icon = icon;
		playerIconChanged.emit(player);
	}
});
client.disconnected.listen(() => {
	joinCode = "";
	players.clear();
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
	static icon(player: Player) {
		return PlayerIcons.view(player.icon, player.color);
	}
	static view(player: Player) {
		return h("div.player-view", [
			Player.icon(player),
			player.name
		]);
	}
}

