
import {
	Signal, //State,
	/*Val, ReceiveIndex, SendIndex,
	client,
	Shared,
	playerIcons,
	h,*/
	Shared,
	Micron
} from "../modules/"
import { 
	Player,
	PlayerMap
} from "./data"

//type Recap = Micron.Builder<[() => void]>;


type GameResults = {
	recap: Micron.Builder<[close: () => void]>
	players: PlayerMap
};

export default class Room {
	static joinCode = "";
	static token = "";
	static leaderId = 255;
	
	//static recapView: Micron.Builder<[() => void]> | undefined;
	//static recapScores
	
	static results: GameResults | undefined;
	static readonly players = new PlayerMap();
	
	static readonly playerJoined = new Signal<[Player]>();
	static readonly playerLeft = new Signal<[Player]>()
	static readonly playerIconChanged = new Signal<[Player]>();
	
	static get joinLink(): string {
		return `https://${window.location.host}/play?code=${Room.joinCode}`;
	}
	
	static reset() {
		this.joinCode = "";
		this.token = "";
		this.leaderId = 255;
		this.players.clear();
	}
	static player(id: number): Player | undefined {
		return this.players.get(id);
	}
	static setJoinCode(newJoinCode: string) {
		this.joinCode = newJoinCode;
	}
	static setToken(newToken: string) {
		this.token = newToken;
	}
	static setLeaderId(newLeaderId: number) {
		this.leaderId = newLeaderId;
	}
	static hasResults(): boolean {
		return this.results !== undefined;
	}
	static setResults(results: GameResults) {
		this.results = results;
	}
	static clearResults() {
		this.results = undefined;
	}
	static connectUrl() {
		return `${Shared.wsRoot}/host/connect`;
	}
	static reconnectUrl(): string | undefined {
		if (this.joinCode === "" || this.token === "") {
			return undefined;
		}
		return `${Shared.wsRoot}/host/reconnect?code=${this.joinCode}&token=${this.token}`;
	}
	
	static Recap(close: () => void) {
		return this.results?.recap(close);
	}
	static mock(playerCount: number) {
		this.players.clear();
		for (let i = 0; i < playerCount; i++) {
			const player = Player.mock(i);
			this.players.add(player);
			this.playerJoined.emit(player);
		}
	}
	static handleJoin(playerId: number, name: string, icon: number) {
		if (this.players.has(playerId)) {
			console.error("received playerJoined for player that is already present");
		}
		const player = new Player(playerId, name, icon);
		this.players.add(player);
		this.playerJoined.emit(player);
	}
	static handleLeave(playerId: number) {
		const player = this.players.get(playerId);
		if (player === undefined) {
			console.warn("received playerLeft for player that is not present");
		} else {
			this.players.remove(playerId);
			this.playerLeft.emit(player);
		}
	}
	static handleIconChanged(playerId: number, icon: number) {
		const player = this.players.get(playerId);
		if (player === undefined) {
			console.warn("received playerIconChanged for player that is not present");
		} else {
			player.icon = icon;
			this.playerIconChanged.emit(player);
		}
	}
}

//export let recap: undefined | ((close: () => void) => Micron.Node);

/*export function setLeaderId(newLeaderId: number) {
	leaderId = newLeaderId;
}*/

/*export function playerCount() {
	return playerMap.size;
}
export function hasPlayer(id: number): boolean {
	return playerMap.has(id);
}
export function player(id: number): Player | undefined;
//export function player(id: number[])
export function player(id: number): Player | undefined {
	return playerMap.get(id);
}
export function players(ids?: number[]): Player[] {
	if (ids === undefined) {
		return Array.from(playerMap.values());
	} else {
		
	}
}*/

/*export function players(ids: Iterable<number>): Player[] {
	const players = 
}*/
/*export function playerName(id: number): string | undefined {
	return player(id)?.name;
}
export function playerIcon(id: number): number {
	return players[id].icon;
}*/
/*export function setRecap(newRecap: undefined | ((close: () => void) => Micron.Node)) {
	recap = newRecap;
}*/


/*export function playerView(id: number, disabled: boolean): Node | undefined {
	const _player = player(id);
	return _player && _player.View();
}
export function iconView(id: number, ): Node | undefined {
	const _player = player(id);
	return _player && _player.IconView();
}*/

/*const INC = new ReceiveIndex({
	"accepted": { joinCode: Val.STR },
	"playerJoined": { playerId: Val.NUM, name: Val.STR, icon: Val.NUM },
	"playerLeft": { playerId: Val.NUM },
	"playerDisconnected": { playerId: Val.NUM },
	"playerReconnected": { playerId: Val.NUM },
	"playerIconChanged": { playerId: Val.NUM, icon: Val.NUM }
});
const OUT = new SendIndex({
	
});*/


/*export class ScoreMap {
	scores = new Map<number, number>();
	
	constructor(ids = playerIds()) {
		for (const id of ids)
			this.scores.set(id, 0);
	}
	reset() {
		this.scores.clear();
		for (const id of playerIds())
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
	*rankings(): IterableIterator<{ id: number, score: number, rank: number }> {
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
	View() {
		let entries = Array.from(this.sorted()).map(({ id, score }) => {
			const player = playerMap.get(id)!;
			return h(
				"div.score-entry",
				player.ScoredView(score)
			);
		});
		
		return h("div.score-entry-ctr", entries);
	}
}*/




