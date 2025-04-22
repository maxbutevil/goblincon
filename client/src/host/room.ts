
import {
	Signal, //State,
	Val, ReceiveIndex, SendIndex,
	client,
	Shared,
	PlayerIcons,
	h, defer,
	VNode
} from "../modules/"


export const playerJoined = new Signal<[Player]>();
export const playerLeft = new Signal<[Player]>()
export const playerIconChanged = new Signal<[Player]>();

export let joinCode = "";
//export let players: Player[] = [];
export let leaderId = 255;
export let playerMap: Map<number, Player> = new Map();
export let recap: undefined | ((close: () => void) => VNode);

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
		const players = [];
		for (const id of ids) {
			const player = playerMap.get(id);
			if (!player) {
				console.error("player not found");
			} else {
				players.push(player);
			}
		}
		return players;
	}
}

/*export function players(ids: Iterable<number>): Player[] {
	const players = 
}*/
/*export function playerName(id: number): string | undefined {
	return player(id)?.name;
}
export function playerIcon(id: number): number {
	return players[id].icon;
}*/
export function playerIds(): IterableIterator<number> {
	return playerMap.keys();
}
export function setRecap(newRecap: undefined | ((close: () => void) => VNode)) {
	recap = newRecap;
}


/*export function playerView(id: number, disabled: boolean): VNode | undefined {
	const _player = player(id);
	return _player && _player.View();
}
export function iconView(id: number, ): VNode | undefined {
	const _player = player(id);
	return _player && _player.IconView();
}*/

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
	playerMap.set(playerId, player);
	playerJoined.emit(player);
});
INC.listen("playerLeft", ({ playerId }) => {
	const player = playerMap.get(playerId);
	if (player === undefined) {
		console.warn("Received playerLeft for player that is not present.");
	} else {
		playerMap.delete(playerId);
		playerLeft.emit(player);
	}
});
INC.listen("playerIconChanged", ({ playerId, icon }) => {
	const player = playerMap.get(playerId);
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
	playerMap.clear();
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
	
	IconView(disabled = false) {
		return PlayerIcons.View(this.icon, this.color, disabled);
	}
	
	View(disabled = false) {
		return h("div.player-view", [
			this.IconView(disabled),
			this.name
		]);
	}
	ScoredView(score: number) {
		return h("div.player-view", [
			this.IconView(),
			`${this.name} (${score}pts)`,
		]);
	}
}

export class VoteQueue {
	update = new Signal();
	votes: number[][] = [];
	private queue: Array<[number, number]> = [];
	
	private build(votes: number[][]) {
		
		function shuffle<T>(array: T[]) {
			let swapIdx, temp;
			for (let i = 0; i < array.length - 1; i++) {
				swapIdx = i + Math.floor(Math.random() * (array.length - i));
				temp = array[i];
				array[i] = array[swapIdx];
				array[swapIdx] = temp;
			}
		}
		
		// shuffle the vote arrays
		// we *do* need the undefined checks; votes may be sparse!
		for (const voteArray of votes)
			if (voteArray)
				shuffle(voteArray);
		
		this.queue = [];
		
		// just picking a really big number that prevents looping forever
		for (let i = 0; i < 1000; i++) {
			let anyLeft = false;
			for (const [forId, voters] of votes.entries()) {
				if (voters !== undefined && voters.length > i) {
					this.queue.push([forId, voters[i]]);
					anyLeft = true;
				}
			}
			if (!anyLeft) break;
		}
		this.queue.reverse();
	}
	start(votes: number[][]) {
		
		if (this.queue.length > 0 || this.votes.length > 0) {
			console.warn("started VoteQueue multiple times");
		}
		
		this.build(votes);
		
		const DELAY_MS = 0.8 * 1000;
		const interval = setInterval(() => {
			const nextVote = this.queue.pop();
			if (nextVote === undefined) {
				clearInterval(interval);
			} else {
				let [forId, playerId] = nextVote;
				(this.votes[forId] ??= []).push(playerId);
				this.update.emit();
				console.warn(forId, playerId);
			}
		}, DELAY_MS);
	}
	get(id: number): number[] {
		return this.votes[id] ??= [];
	}
}

export class ScoreMap {
	scores = new Map<number, number>();
	
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
}
class Rounds<R> {
	rounds: R[] = [];
}




