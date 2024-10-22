

import {
	Signal, State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex
} from "../modules/index"


import client from "../modules/client"
import * as Utils from "../modules/shared"
import { h, signaled, stateful, VNode } from "../modules/render"

import * as Room from "./room"
import { Player } from "./room"
import Setting, { SettingsRemoteOf, toRemote } from "./setting"
import * as PlayerIcons from "../modules/player_icons"

//import { motion } from "framer-motion"

const INC = new ReceiveIndex({
	"gameStarted": Validate.NONE, // Kind of vestigial
	"drawing": { goblinName: Validate.STRING },
	"voting": Validate.NONE,
	"results": Validate.NONE,
	"scoring": Validate.NONE,
	"drawingSubmitted": { playerId: Validate.NUMBER, drawing: Validate.STRING },
	"voteSubmitted": { playerId: Validate.NUMBER, forId: Validate.NUMBER }
});
const OUT = new SendIndex({
	"terminate": Validate.NONE
});

export const settings = {
	roundCount: new Setting("Number of Rounds", [ 1, 2, 3, 5, 8 ]),
	drawTimeFactor: Setting.multiplier("Drawing Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	voteTimeFactor: Setting.multiplier("Voting Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	scoreTimeFactor: Setting.multiplier("Scoring Time", [0.7, 1.0, 1.3])
	//keepScores: Setting.multiplier("")
};

export type SettingsRemote = SettingsRemoteOf<typeof settings>;
export function getSettingsRemote(): SettingsRemote {
	return toRemote(settings);
}

type Page = 
	Variant<"starting"> |
	Variant<"drawing"> |
	Variant<"voting"> |
	Variant<"scoring">;
const page = new State<Page>(unit("starting"));
const voteRevealed = new Signal<{ playerId: number, forId: number }>();
//const voteRevealed = new Signal<{ }>();


let rounds: Round[];
let scores: number[];

function currentRound(): Round {
	return rounds.at(-1)!;
}
function getScore(playerId: number) {
	return scores[playerId] ?? 0;
}
function addScore(playerId: number, amount: number) {
	scores[playerId] = getScore(playerId) + amount;
}

INC.listen("gameStarted", () => {});
INC.listen("drawing", ({ goblinName }) => {
	rounds.push(new Round(goblinName));
	page.set(unit("drawing"));
});
INC.listen("voting", () => page.set(unit("voting")));
INC.listen("results", () => {
	
	const DELAY_MS = 0.8 * 1000;
	
	let round = currentRound();
	for (const id of Room.playerIds())
		addScore(id, round.votesReceived[id]?.length ?? 0);
	
	let voteQueue: { playerId: number, forId: number }[] = [];
	
	for (let i = 0; i < 100; i++) {
		let anyLeft = false;
		for (const [forId, votes] of round.votesReceived.entries()) {
			if (votes !== undefined && votes.length > i) {
				voteQueue.push({ playerId: votes[i], forId })
				anyLeft = true;
			}
		}
		if (!anyLeft) break;
	}
	
	voteQueue.reverse();
	
	let interval = setInterval(() => {
		let nextVote = voteQueue.pop();
		if (page.get().key !== "voting" || nextVote === undefined)
			clearInterval(interval);
		else
			voteRevealed.emit(nextVote);
	}, DELAY_MS);
	
});
INC.listen("scoring", () => page.set(unit("scoring")));
INC.listen("drawingSubmitted", ({ playerId, drawing }) => {
	currentRound().handleDrawing(playerId, drawing);
});
INC.listen("voteSubmitted", ({ playerId, forId }) => {
	currentRound().handleVote(playerId, forId);
});

export function init() {
	rounds = [];
	scores = [];
	page.set(unit("starting"));
	return client.use(INC, OUT);
}
export function view() {
	init();
	
	return stateful(page, (curr) => {
		switch (curr.key) {
			case "starting": return starting();
			case "drawing": return drawing();
			case "scoring": return scoring();
			case "voting": return voting();
		}
	});
	
}
function starting() {
	return h(
		"div.tab",
		h("h1", "Starting!")
	);
}
function drawing() {
	return h(
		"div.tab",
		[
			h("h2", "Draw a creature named..."),
			h("h1", currentRound().goblinName)
		]
	);
}
function voting() {
	
	let votes: number[][] = [];
	
	return signaled(voteRevealed, vote => {
		
		if (vote) {
			let { playerId, forId } = vote;
			votes[forId] ??= [];
			votes[forId].push(playerId);
		}
		
		let submissions: VNode[] = [];
		for (const id of Room.playerIds()) {
			if (currentRound().drawings[id] !== undefined)
				submissions.push(submission(id, votes[id]));
		}
		
		let aspectRatio = window.innerWidth / window.innerHeight;
		let rowWidth = submissions.length;
		let rowCount = 1;
		if (submissions.length >= aspectRatio * 2.4) {
			for (let i = 2; i < submissions.length; i++) {
				rowCount = i;
				rowWidth = Math.ceil(submissions.length/i);
				if ((rowWidth / i) <= aspectRatio * 1.2)
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
			
		let ctrSelector = rowCount <= 1 ? "div.submission-ctr.single-row" : "div.submission-ctr";
		
		return h(
			"div.tab",
			[
				h("div", `Vote for your favorite ${currentRound().goblinName}!`),
				h(ctrSelector, rows.map(row => h("div.submission-row", row)))
			]
		);
	});
	
}
function scoring() {
	
	let sortedIds = Room.playerIds().sort((a, b) => {
		return getScore(b) - getScore(a);
	});
	
	let entries: VNode[] = [];
	let rank = 1;
	for (let i = 0; i < sortedIds.length; i++) {
		let id = sortedIds[i], score = getScore(id);
		// If score is tied with the previous player, their rank is the same
		if (i > 0 && score < getScore(sortedIds[i-1]))
			rank = i+1;
		entries.push(scoreEntry(id, rank));
	}
	
	return h(
		"div.tab",
		[
			h("h1", "Scores"),
			h("div.score-entry-ctr", entries)
		]
	);
}
function submission(playerId: number, votes: number[] = []) {
	
	//const playerName = Room.playerName(playerId);
	//const drawing = currentRound().drawings[playerId];
	let player = Room.player(playerId)!;
	let drawing = currentRound().drawings[playerId];
	
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			Player.view(player),
			h("div.vote-ctr", votes.map(playerId => {
				return Player.icon(Room.players[playerId]);
			}))
		]
	);
}
function scoreEntry(playerId: number, rank: number) {
	//let name = Room.playerName(playerId);
	let player = Room.players[playerId];
	let score = getScore(playerId);
	return h(
		"div.score-entry",
		[
			h("div.player-view", [
				Player.icon(player),
				`${player.name} (${score}pts)`,
			]),
			//h("span.name", `${rank}. ${name}`),
		]
	);
}

class Round {
	goblinName: string;
	drawings: string[] = []; //new Map<Player, string>();
	//votes: number[] = []; // = new Map<number, number>();
	//voteCounts: number[] = []; // = new Map<number, number>();
	votesSent: number[] = [];
	votesReceived: number[][] = [];
	
	constructor(goblinName: string) {
		this.goblinName = goblinName;
	}
	handleDrawing(playerId: number, drawing: string) {
		this.drawings[playerId] = drawing;
	}
	handleVote(playerId: number, forId: number) {
		this.votesSent[playerId] = forId;
		this.votesReceived[forId] ??= [];
		this.votesReceived[forId].push(playerId);
	}
	/*drawing(playerId: number): string | undefined {
		return this.drawings[playerId];
	}*/
}











