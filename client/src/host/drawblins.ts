

import {
	Signal, State, Variant, variant,
	Val, ReceiveIndex, SendIndex,
	h, s, defer, projector, VNode,
	
	Shared as Utils,
	client
} from "../modules/index"

import * as Room from "./room"
import { Player, ScoreMap } from "./room"
import { Mode, Setting } from "./mode"
import * as PlayerIcons from "../modules/player_icons"


//import { motion } from "framer-motion"

const INC = new ReceiveIndex({
	
	"drawing": { goblinName: Val.STR },
	"voting": Val.NONE,
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
	
	"drawingSubmitted": { playerId: Val.NUM, drawing: Val.STR },
	"voteSubmitted": { playerId: Val.NUM, forId: Val.NUM },
});
const OUT = new SendIndex({
	//"terminate": Val.NONE
});

const mode = new Mode("drawblins", view, {
	roundCount: new Setting("Number of Rounds", [ 1, 2, 3, 5, 8 ]),
	drawTimeFactor: Setting.multiplier("Drawing Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	voteTimeFactor: Setting.multiplier("Voting Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	scoreTimeFactor: Setting.multiplier("Scoring Time", [0.7, 1.0, 1.3])
});

export default mode;


const page = projector(starting);
const voteRevealed = new Signal<{ playerId: number, forId: number }>();

let rounds: Round[];
let scores = new ScoreMap();

function currentRound(): Round {
	return rounds.at(-1)!;
}

INC.listen("drawing", ({ goblinName }) => {
	rounds.push(new Round(goblinName));
	page.put(drawing);
});
INC.listen("voting", () => page.put(voting));
INC.listen("showingVotes", () => {
	
	const DELAY_MS = 0.8 * 1000;
	
	let round = currentRound();
	for (const id of Room.playerIds())
		scores.add(id, round.votesReceived[id]?.length ?? 0);
	
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
		if (/* page.get().key !== "voting" || */ nextVote === undefined)
			clearInterval(interval);
		else
			voteRevealed.emit(nextVote);
	}, DELAY_MS);
	
});
INC.listen("showingScores", () => page.put(showingScores));
INC.listen("drawingSubmitted", ({ playerId, drawing }) => {
	currentRound().handleDrawing(playerId, drawing);
});
INC.listen("voteSubmitted", ({ playerId, forId }) => {
	currentRound().handleVote(playerId, forId);
});

export function view() {
	rounds = [];
	scores.reset(Room.playerIds());
	defer(client.use(INC, OUT));
	return s(page);
}
function starting() {
	return h(
		"div.tab",
		h("h1", "Game Starting!")
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
	
	return s(voteRevealed, vote => {
		
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
function showingScores() {
	return h(
		"div.tab",
		[
			h("h1", "Scores"),
			h("h2", `Round ${rounds.length}/${mode.setting("roundCount")}`),
			ScoreMap.view(scores)
		]
	);
}
function submission(playerId: number, votes: number[] = []) {
	
	//const playerName = Room.playerName(playerId);
	//const drawing = currentRound().drawings[playerId];
	const player = Room.player(playerId)!;
	const drawing = currentRound().drawings[playerId];
	
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			Player.view(player),
			h("div.vote-ctr", votes.map(playerId => {
				const player = Room.players.get(playerId);
				return player === undefined ? null : Player.icon(player);
			}))
		]
	);
}
function scoreEntry(playerId: number, rank: number) {
	//let name = Room.playerName(playerId);
	const player = Room.players.get(playerId)!;
	const score = scores.get(playerId);
	
	
}


class Round {
	goblinName: string;
	drawings: string[] = []; 
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
		(this.votesReceived[forId] ??= []).push(playerId);
	}
}











