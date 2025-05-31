
import {
	State,
	h, s, c, defer, Micron,
	Signal,
	//Shared, playerIcons,
} from "../modules/"
import { Player } from "./data"
import { Countdown } from "../components"
import type { SubmissionData } from "../modules/data"

export function Submission(player: Player, data: SubmissionData, { votes }: { votes?: Player[] } = {}) {
	
	const { drawing, name } = data;
	const filename = `goblincon-${name ?? "unnamed"}`;
	
	const votesCtr = c(
		votes &&
		votes.length > 0 &&
		h("div.vote-ctr", votes.map(player => player.IconView()))
	);
	//const votesCtr = c(votes && votes.length > 0 && h("div.vote-ctr", Player.iconView(vote)));
	
	//const playerView = typeof player === "number" ? Room.playerView(player) : Player.view(player);
	return h(
		"div.submission",
		[
			c(name && h("div.name", name)),
			h("a.img-ctr",
				{ attrs: { href: drawing, download: filename } },
				[
					h("img.drawing", { attrs: { src: drawing } }),
					votesCtr
				]
			),
			player.View()
		]
	);
}
export function SubmissionGrid(submissions: Micron.Node[]): Micron.Node {
	/* This is a nightmare, but so are 2D flexbox layouts */
	/* And it works! */
	let aspectRatio = window.innerWidth / (window.innerHeight - 60);
	let rowWidth = submissions.length;
	let rowCount = 1;
	if (submissions.length >= aspectRatio * 1.84) {
		for (let i = 2; i < submissions.length; i++) {
			rowCount = i;
			rowWidth = Math.ceil(submissions.length/i);
			if ((rowWidth / i) <= aspectRatio * 1.11)
				break;
		}
	}
	
	let rows: Micron.Node[][] = [];
	for (let i = 0; i < rowCount; i++)
		rows.push([]);
	
	for (let i = 0; i < submissions.length; i++) {
		let row = Math.floor(i/rowWidth);
		rows[row].push(submissions[i]);
	}
	
	let fontSize = "1em";
	switch (rows.length) {
		case 0: case 1: break;
		case 2: fontSize = "0.9em"; break;
		case 3: fontSize = "0.8em"; break;
		case 4: fontSize = "0.7em"; break;
		default: fontSize = "0.6em"; break;
	}
	
	return h(
		"div.submission-ctr",
		{ style: { fontSize } },
		rows.map(row => h("div.submission-row", row))
	);
}

export class ReadyDisplay {
	
	private readonly update = new Signal();
	private players: Player[];
	private readied: number[] = [];
	private countdown?: Countdown;
	
	constructor(players: Player[], secsLeft?: number, secsBuffer?: number) {
		this.players = players;
		if (secsLeft !== undefined) {
			this.countdown = Countdown.fromSecs(secsLeft, secsBuffer ?? 0);
		}
	}
	ready(id: number) {
		this.readied.push(id);
		this.update.emit();
	}
	stopCountdown() {
		this.countdown?.stop();
	}
	View(): Micron.Node {
		return s(this.update, () => h("div#ready-display", [
			this.countdown?.View(),
			...this.players.map((player) => {
				const ready = this.readied.includes(player.id);
				return player.IconView(!ready);
			})
		]));
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



