
import {
	Signal, State, Variant, variant,
	Val, ReceiveIndex, SendIndex,
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
export let leaderId = 255;
export let players: Map<number, Player> = new Map();

export function setJoinCode(code: string) {
	joinCode = code;
}
/*export function getJoinCode(): string {
	return joinCode;
}*/
export function setLeaderId(newLeaderId: number) {
	leaderId = newLeaderId;
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
	"accepted": { joinCode: Val.STR },
	"playerJoined": { playerId: Val.NUM, name: Val.STR, icon: Val.NUM },
	"playerLeft": { playerId: Val.NUM },
	"playerDisconnected": { playerId: Val.NUM },
	"playerReconnected": { playerId: Val.NUM },
	"playerIconChanged": { playerId: Val.NUM, icon: Val.NUM }
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
INC.listen("playerReconnected", ({ playerId }) => {
	// Don't need to do anything, but it shuts up warnings!
	// (I may or may not have made those warnings myself)
});
INC.listen("playerDisconnected", ({ playerId }) => {
	
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
	static scoredView(player: Player, score: number) {
		return h("div.player-view", [
			Player.icon(player),
			`${player.name} (${score}pts)`,
		]);
	}
}

export class ScoreMap {
	scores = new Map<number, number>();
	
	constructor(playerIds: Iterable<number> = []) {
		this.reset(playerIds);
	}
	reset(playerIds: Iterable<number>) {
		this.scores.clear();
		for (const id of playerIds)
			this.scores.set(id, 0);
	}
	get(playerId: number): number {
		if (!this.scores.has(playerId)) {
			console.warn("attempted to retrieve score for player that is not present in ScoreMap:", playerId);
			return 0;
		}
		return this.scores.get(playerId)!;
	}
	add(playerId: number, amount: number): number {
		let newScore = this.get(playerId) + amount;
		this.scores.set(playerId, newScore);
		return newScore;
	}
	
	ids(): IterableIterator<number> {
		return this.scores.keys();
	}
	sortedIds(): number[] {
		return Array.from(this.ids()).sort((a, b) => {
			return this.get(b) - this.get(a);
		});
	}
	*sorted(): IterableIterator<{ id: number, score: number }> {
		for (const id of this.sortedIds())
			yield { id, score: this.get(id) };
	}
	*rankings(): IterableIterator<{ id: number, score: number, rank: number  }> {
		let i = 0, rank = 1, prevScore;
		for (const { score, id } of this.sorted()) {
			if (!prevScore) {
				prevScore = score;
			} else {
				// If score is tied with that of the previous player, their rank is the same
				// Otherwise, increase it
				if (score !== prevScore)
					rank = i + 1;
			}
			yield { rank, score, id };
			prevScore = score;
		}
	}
	static view(scores: ScoreMap) {
		
		let entries = Array.from(scores.sorted()).map(({ id, score }) => {
			const player = players.get(id)!;
			return h(
				"div.score-entry",
				Player.scoredView(player, score)
			);
		});
		
		return h("div.score-entry-ctr", entries);
	}
}
class Rounds<R> {
	rounds: R[] = [];
}




