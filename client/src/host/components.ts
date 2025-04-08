
import {
	State,
	h, s, c, defer,
	VNode, VNodeChildElement,
	Signal,
	//Shared, PlayerIcons,
} from "../modules/"
import * as Room from "./room"
import { Player } from "./room"
import { Countdown } from "../components"
import type { Submission } from "../modules/submission"

export function submission(player: Player, content: Submission, { votes }: { votes?: Player[] } = {}) {
	
	const { drawing, name } = content;
	const filename = `goblincon-${name ?? "unnamed"}`;
	
	const voteIcons = votes && votes.length > 0 && votes.map(player =>
		Player.iconView(player)
	);
	const votesCtr = c(voteIcons && h("div.vote-ctr", voteIcons));
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
			Player.view(player)
		]
	);
}
export function submissionGrid(submissions: VNode[]): VNode {
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
	
	let rows: VNode[][] = [];
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
	view(): VNode {
		return s(this.update, () => h("div#ready-icons", [
			this.countdown?.view(),
			...this.players.map((player) => {
				const ready = this.readied.includes(player.id);
				return Player.iconView(player, !ready);
			})
		]));
	}
}


