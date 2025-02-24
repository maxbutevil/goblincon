

import { idlePage } from "../components/index";
import {
	Shared,
	Signal,
	Val, ReceiveIndex, SendIndex,
	h, s, defer, projector, VNode,
	
	client
} from "../modules/index"

import * as Room from "./room"
import { Player, ScoreMap } from "./room"
import { Mode, Setting } from "./mode"

import {
	img,
	mountedBtn
} from "../components/index"


const mode = new Mode("dating", view, {
	roundCount: new Setting("Number of Rounds", [ 1, 2, 3 ]),
	bachelorDrawTimeFactor: Setting.multiplier("Bachelor Drawing Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	suitorDrawTimeFactor: Setting.multiplier("Suitor Drawing Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	voteTimeFactor: Setting.multiplier("Voting Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	scoreTimeFactor: Setting.multiplier("Scoring Time", [0.7, 1.0, 1.3])
	//keepScores: Setting.multiplier("")
});

export default mode;


const INC = new ReceiveIndex({
	"drawingBachelors": { theme: Val.STR },
	"drawingSuitors": Val.NONE,
	"voting": { bachelorId: Val.NUM },
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
	
	"bachelorSubmitted": { drawing: Val.STR, playerId: Val.NUM },
	"suitorSubmitted": { drawing: Val.STR, playerId: Val.NUM, bachelorId: Val.NUM },
	"voteSubmitted": { playerId: Val.NUM, forId: Val.NUM },
});
const OUT = new SendIndex({
	/* Nothing */
});

INC.listen("drawingBachelors", ({ theme }) => {
	rounds.push(new Round(theme));
	page.put(drawingBachelors, theme);
});
INC.listen("drawingSuitors", () => {
	page.put(drawingSuitors);
});
INC.listen("showingScores", () => {
	page.put(showingScores);
});
INC.listen("voting", ({ bachelorId }) => {
	page.put(voting, bachelorId)
});

INC.listen("bachelorSubmitted", ({ playerId, drawing }) => {
	currentRound().handleBachelorDrawing(playerId, drawing)
});
INC.listen("suitorSubmitted", ({ playerId, bachelorId, drawing }) => {
	currentRound().handleSuitorDrawing(bachelorId, playerId, drawing);
});


let rounds: Round[] = [];
let scores = new ScoreMap();
function currentRound(): Round { return rounds.at(-1)!; }

const page = projector(starting);
function starting() {
	return idlePage("Game Starting!", "(Dating Mode)", "Get ready to draw!");
}
function drawingBachelors(theme: string) {
	return h("div.tab", [
		h("h1", "Draw your Bachelor!"),
		h("h3", "Draw a bachelor that fits the theme:"),
		h("h2", theme),
	]);
}
function drawingSuitors() {
	return h("div.tab", [
		h("h1", "Draw your Suitors!"),
		h("h2", "Draw creatures that would make good partners for the bachelors you have received")
	]);
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
function voting(bachelorId: number) {
	
	defer(Signal.bundle(
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			currentRound().handleVote(bachelorId, playerId, forId);
			//currentRound().handleVote(playerId, forId);
		}),
		INC.subscribe("showingVotes", () => {
			
		})
	));
	
	const submission = currentRound().submission(bachelorId)!;	
	const suitorDrawings = submission.suitors.map(({ drawing }) =>
		img(drawing)
	);
	
	
	return h("div#voting.tab", [
		h("div.hflow", [
			img(submission.bachelorDrawing)
		]),
		h("div.hflow", [
			...suitorDrawings
			//img(submission.suitors[0].drawing),
			//img(submission.suitors[1].drawing),
		])
	]);
}

function submission(playerId: number, drawing: string) {
	
	const player = Room.player(playerId)!;
	
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing } }),
			Player.view(player)
		]
	);
}


export function view() {
	defer(client.use(INC, OUT));
	return s(page);
}

type Suitor = { id: number, drawing: string, votes: number[] };
class Submission {
	bachelorDrawing: string;
	suitors: Suitor[] = [];
	
	constructor(bachelorDrawing: string) {
		this.bachelorDrawing = bachelorDrawing;
	}
	suitor(suitorId: number): Suitor | undefined {
		for (const suitor of this.suitors)
			if (suitor.id === suitorId) return suitor;
	}
}
class Round {
	theme: string;
	submissions = new Map<number, Submission>();
	
	constructor(theme: string) {
		this.theme = theme;
	}
	
	submission(bachelorId: number): Submission | undefined {
		return this.submissions.get(bachelorId);
	}
	handleBachelorDrawing(playerId: number, drawing: string) {
		this.submissions.set(playerId, new Submission(drawing));
	}
	handleSuitorDrawing(bachelorId: number, playerId: number, drawing: string) {
		let submission = this.submissions.get(bachelorId);
		if (!submission) {
			console.error("invalid bachelor id for suitor drawing submission");
			return;
		}
		submission.suitors.push({ id: playerId, drawing, votes: [] });
	}
	handleVote(bachelorId: number, playerId: number, forId: number) {
		const submission = this.submission(bachelorId);
		if (!submission) return console.error("invalid bachelorId for vote:", bachelorId);
		const suitor = submission.suitor(forId);
		if (!suitor) return console.error("invalid suitorId for vote:", forId);
		suitor.votes.push(playerId);
	}
}

