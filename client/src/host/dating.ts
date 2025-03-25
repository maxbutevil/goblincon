


import {
	//Shared,
	//Signal,
	Val, ReceiveIndex, SendIndex,
	h, s, defer, projector, VNode,
	
	client
} from "../modules/"

import * as Room from "./room"
import { Player, ScoreMap } from "./room"
import { Mode, Setting } from "./mode"

import {
	idlePage
} from "../components"
import {
	submission
} from "./components"
import * as icons from "../assets/icons"

const INC = new ReceiveIndex({
	"drawingBachelors": { theme: Val.STR },
	"drawingSuitors": Val.NONE,
	"voting": { bachelorId: Val.NUM },
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
	
	"bachelorSubmitted": { drawing: Val.STR, name: Val.optional(Val.STR), playerId: Val.NUM },
	"suitorSubmitted": { drawing: Val.STR, name: Val.optional(Val.STR), playerId: Val.NUM, bachelorId: Val.NUM },
	"voteSubmitted": { playerId: Val.NUM, forId: Val.NUM },
});
const OUT = new SendIndex({
	/* Nothing */
});

const mode = new Mode("dating", view, {
	roundCount: new Setting("Number of Rounds", [ 1, 2, 3 ]),
	naming: Setting.boolean("Creature Naming", true),
	bachelorDrawTimeFactor: Setting.multiplier("Bachelor Drawing Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	suitorDrawTimeFactor: Setting.multiplier("Suitor Drawing Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	voteTimeFactor: Setting.multiplier("Voting Time", [ 0.5, 0.8, 1.0, 1.3, 2.0 ]),
	scoreTimeFactor: Setting.multiplier("Scoring Time", [0.7, 1.0, 1.3])
	//keepScores: Setting.multiplier("")
});

export default mode;

let rounds: Round[] = [];
let scores = new ScoreMap();
function currentRound(): Round { return rounds.at(-1)!; }

const page = projector(starting);

function view() {
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawingBachelors", ({ theme }) => {
			rounds.push(new Round(theme));
			page.put(drawingBachelors, theme);
		}),
		INC.subscribe("drawingSuitors", () => page.put(drawingSuitors)),
		INC.subscribe("showingScores", () => page.put(showingScores)),
		INC.subscribe("voting", ({ bachelorId }) => page.put(voting, bachelorId)),
		INC.subscribe("bachelorSubmitted", ({ playerId, drawing, name }) => {
			currentRound().handleBachelorDrawing(playerId, drawing, name)
		}),
		INC.subscribe("suitorSubmitted", ({ playerId, bachelorId, drawing, name }) => {
			currentRound().handleSuitorDrawing(bachelorId, playerId, drawing, name);
		})
	);
	rounds = [];
	scores.reset();
	return h("div#dating.mode", s(page));
}
function starting() {
	return idlePage("Game Starting!", "(Dating Mode)", "Get ready to draw!");
}
function drawingBachelors(theme: string) {
	return h("div#drawing-bachelors.tab", [
		h("h1", "Draw your Bachelor!"),
		h("h3", "Draw a bachelor that fits the theme:"),
		h("h2", theme),
	]);
}
function drawingSuitors() {
	return h("div#drawing-suitors.tab", [
		h("h1", "Draw your Suitors!"),
		h("h2", "Draw creatures that would make good partners for the bachelors you have received")
	]);
}
function showingScores() {
	return h("div#showing-scores.tab", [
		h("h1", "Scores"),
		h("h2", `Round ${rounds.length}/${mode.setting("roundCount")}`),
		scores.view()
	]);
}
function voting(bachelorId: number) {
	
	const round = currentRound();
	const matchup = round.matchup(bachelorId)!;
	const voteQueue = new Room.VoteQueue();
	
	defer(
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			round.handleVote(bachelorId, playerId, forId);
		}),
		INC.subscribe("showingVotes", () => {
			// Increase scores
			for (const { id, votes } of matchup.suitors)
				scores.add(id, votes.length);
			
			// Start revealing votes
			const votes = matchup.suitors.map(suitor => suitor.votes);
			voteQueue.start(votes);
		})
	);
	
	return s(voteQueue.update, () => {
		
		let bachelorDrawing = submission(bachelorId, matchup.bachelorDrawing, {
			name: matchup.bachelorDrawingName
		});
		
		let suitors = matchup.suitors.sort((a, b) => a.id - b.id);
		let suitorDrawings = matchup.suitors.map(({ id, drawing, name }, index) =>
			submission(id, drawing, { name, voteIds: voteQueue.votes[index] })
		);
		
		
		if (suitorDrawings.length === 2) {
			suitorDrawings = [
				suitorDrawings[0],
				h("img#vs-icon", { attrs: { src: icons.vs } }),
				suitorDrawings[1]
			]
		}
		
		return h("div#voting.tab", [
			h("div.submission-ctr", [
				h("div.submission-row", bachelorDrawing),
				h("div.submission-row", suitorDrawings)
			])
		]);
	});
}

type Suitor = { id: number, drawing: string, name: string | undefined, votes: number[] };
class Matchup {
	bachelorDrawing: string;
	bachelorDrawingName: string | undefined;
	suitors: Suitor[] = [];
	
	constructor(bachelorDrawing: string, bachelorDrawingName?: string) {
		this.bachelorDrawing = bachelorDrawing;
		this.bachelorDrawingName = bachelorDrawingName;
	}
	suitor(suitorId: number): Suitor | undefined {
		for (const suitor of this.suitors)
			if (suitor.id === suitorId) return suitor;
	}
}
class Round {
	theme: string;
	matchups = new Map<number, Matchup>();
	
	constructor(theme: string) {
		this.theme = theme;
	}
	
	matchup(bachelorId: number): Matchup | undefined {
		return this.matchups.get(bachelorId);
	}
	handleBachelorDrawing(playerId: number, drawing: string, name?: string) {
		this.matchups.set(playerId, new Matchup(drawing, name));
	}
	handleSuitorDrawing(bachelorId: number, playerId: number, drawing: string, name?: string) {
		let matchup = this.matchup(bachelorId);
		if (!matchup) {
			console.error("invalid bachelor id for suitor drawing submission");
			return;
		}
		matchup.suitors.push({ id: playerId, drawing, name, votes: [] });
	}
	handleVote(bachelorId: number, playerId: number, forId: number) {
		const matchup = this.matchup(bachelorId);
		if (!matchup) return console.error(`invalid bachelorId for vote: ${bachelorId} -> ${forId}`);
		const suitor = matchup.suitor(forId);
		if (!suitor) return console.error(`invalid suitorId for vote: ${bachelorId} -> ${forId}`);
		suitor.votes.push(playerId);
	}
}

