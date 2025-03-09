

import {
	Signal, //State,
	Val, ReceiveIndex, SendIndex,
	h, s, defer, projector, VNode,
	
	client
} from "../modules/index"

import * as Room from "./room"
import { Player, ScoreMap } from "./room"
import { Mode, Setting } from "./mode"
import * as PlayerIcons from "../modules/player_icons"
import { submission } from "./components"


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

let rounds: Round[];
let scores = new ScoreMap();

function currentRound(): Round {
	return rounds.at(-1)!;
}

export function view() {
	rounds = [];
	scores.reset();
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName }) => {
			rounds.push(new Round(goblinName));
			page.put(drawing);
		}),
		INC.subscribe("voting", () => page.put(voting)),
		INC.subscribe("showingScores", () => page.put(showingScores)),
		INC.subscribe("drawingSubmitted", ({ playerId, drawing }) => {
			currentRound().handleDrawing(playerId, drawing);
		}),
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			currentRound().handleVote(playerId, forId);
		})
	);
	return h("div#drawblins.mode", s(page));
}
function starting() {
	return h(
		"div#starting.tab",
		h("h1", "Game Starting!")
	);
}
function drawing() {
	return h(
		"div#drawing.tab",
		[
			h("h2", "Draw a creature named..."),
			h("h1", currentRound().goblinName)
		]
	);
}
function voting() {
	
	const voteQueue = new Room.VoteQueue();
	const round = currentRound();
	
	defer(
		INC.subscribe("showingVotes", () => {
			const votes = round.votesReceived;
			// Increase scores
			for (const id of Room.playerIds())
				scores.add(id, votes[id]?.length ?? 0);
			// Start revealing votes
			voteQueue.start(votes);
		})
	);
	
	return s(voteQueue.update, () => {
		
		let submissions: VNode[] = [];
		for (const id of Room.playerIds()) {
			const drawing = round.drawings[id];
			if (drawing != undefined)
				submissions.push(submission(id, drawing, voteQueue.votes[id]));
		}
		
		/* This is a nightmare, but so are 2D flexbox layouts */
		/* And it works! */
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
		
		return h("div#voting.tab", [
			h("div", `Vote for your favorite ${round.goblinName}!`),
			h("div.submission-ctr", rows.map(row => h("div.submission-row", row)))
		]);
	});
	
}
function showingScores() {
	return h(
		"div#showing-scores.tab",
		[
			h("h1", "Scores"),
			h("h2", `Round ${rounds.length}/${mode.setting("roundCount")}`),
			scores.view()
		]
	);
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











