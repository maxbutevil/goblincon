


import Signal from "../modules/signal"
import State from "../modules/state"
import { Variant, unit, variant } from "../modules/variant"
import Validate, { ReceiveIndex, SendIndex } from "../modules/validate"
import client from "../modules/client"
import * as Utils from "../modules/utils"
import { h, signaled, stateful, VNode } from "../modules/render"

import * as Room from "./room"
import Setting, { SettingsRemoteOf, toRemote } from "./setting"

//import { motion } from "framer-motion"

const INC = new ReceiveIndex({
	"gameStarted": Validate.NONE,
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
const voteRevealed = new Signal<number>();

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

INC.listen("drawing", ({ goblinName }) => {
	rounds.push(new Round(goblinName));
	page.set(unit("drawing"));
});
INC.listen("voting", () => page.set(unit("voting")));
INC.listen("results", () => {
	
	const DELAY_MS = 0.9 * 1000;
	
	let round = currentRound();
		for (const id of Room.playerIds())
			addScore(id, round.voteCounts[id] ?? 0);
	
	//let votesLeft = new Map(round.voteCounts.entries());
	let voteQueue: number[] = [];
	//console.log(round.voteCounts, round.votes);
	
	for (let i = 0; i < 100; i++) {
		let anyLeft = false;
		for (const [player, count] of round.voteCounts.entries()) {
			if (count > i) {
				voteQueue.push(player);
				anyLeft = true;
			}
		}
		if (!anyLeft) break;
	}
	
	//voteQueue.reverse();
	//console.log(voteQueue);
	
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
	
	let playerIds = Room.playerIds();
	let playerCount = playerIds.length;
	
	return h(
		"div.tab",
		[
			h("div", `Vote for your favorite ${currentRound().goblinName}!`),
			h("div.submission-ctr", Room.playerIds().map(id => submission(id)))
			/*h("div.submission-ctr", [
				...Room.playerIds().map(id => submission(id)),
				...Room.playerIds().map(id => submission(id)),
				...Room.playerIds().map(id => submission(id)),
				...Room.playerIds().map(id => submission(id)),
				...Room.playerIds().map(id => submission(id))
			])*/
		]
	);
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
function submission(playerId: number) {
	
	const playerName = Room.playerName(playerId);
	const drawing = currentRound().drawings[playerId];
	
	if (playerName === undefined || drawing === undefined)
		return null;
	
	/*let voteIcons = [];
	for (let i = 0; i < voteCount; i++)
		voteIcons.push(<VoteIcon key={i} index={i} />)*/
	
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			h("div.player-name", playerName),
			/* vote icons here */
		]
	);
}
function scoreEntry(playerId: number, rank: number) {
	let name = Room.playerName(playerId);
	let score = getScore(playerId);
	return h(
		"div.score-entry",
		[
			h("span.name", `${rank}. ${name}`),
			h("span.score", score)
		]
	);
}
function VoteIcon({ index }: { index: number }) {
	return h("div.vote-icon.fade-in");
}

class Round {
	goblinName: string;
	drawings: string[] = []; //new Map<Player, string>();
	votes: number[] = []; // = new Map<number, number>();
	voteCounts: number[] = []; // = new Map<number, number>();
	
	constructor(goblinName: string) {
		this.goblinName = goblinName;
	}
	handleDrawing(playerId: number, drawing: string) {
		this.drawings[playerId] = drawing;
	}
	handleVote(playerId: number, forId: number) {
		this.votes[playerId] = forId;
		this.voteCounts[forId] = 1 + (this.voteCounts[forId] ?? 0);
	}
}











