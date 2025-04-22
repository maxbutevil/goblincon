

import {
	Signal, //State,
	Val, ReceiveIndex, SendIndex,
	h, s, defer, projector, VNode,
	
	Shared, client
} from "../modules/"

import * as Room from "./room"
import { Player, ScoreMap } from "./room"
import { Mode, Setting } from "./mode"
import { Submission, SubmissionGrid, ReadyDisplay } from "./components"

const INC = new ReceiveIndex({
	"drawing": { goblinName: Val.STR, secsLeft: Val.NUM },
	"voting": { secsLeft: Val.NUM },
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
	
	"drawingSubmitted": { playerId: Val.NUM, drawing: Val.STR },
	"voteSubmitted": { playerId: Val.NUM, forId: Val.NUM },
	//"finished": Val.NONE,
});
const OUT = new SendIndex({
	//"terminate": Val.NONE
});


const mode = new Mode("drawblins", view, {
	roundCount: new Setting(
		"Number of Rounds",
		[ 1, 2, 3, 5, 8 ],
		{ key: "drawblinsRoundCount" }
	),
	drawTimeFactor: Setting.multiplier(
		"Drawing Time",
		[ 0.5, 0.8, 1.0, 1.3, 2.0 ],
		{ key: "drawblinsDrawTimeFactor" }
	),
	voteTimeFactor: Setting.multiplier(
		"Voting Time",
		[ 0.5, 0.8, 1.0, 1.3, 2.0 ],
		{ key: "drawblinsVoteTimeFactor" }
	),
	scoreTimeFactor: Setting.multiplier(
		"Scoring Time",
		[0.7, 1.0, 1.3],
		{ key: "drawblinsScoreTimeFactor" }
	)
});
export default mode;


const page = projector(Starting);

let rounds: Round[];
let scores = new ScoreMap();

function currentRound(): Round {
	return rounds.at(-1)!;
}

export function view() {
	rounds = [];
	scores.reset();
	
	//defer(setRecap);
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, secsLeft }) => {
			rounds.push(new Round(goblinName));
			page.put(Drawing, secsLeft);
		}),
		INC.subscribe("voting", ({ secsLeft }) => page.put(Voting, secsLeft)),
		INC.subscribe("showingScores", () => page.put(ShowingScores)),
	);
	return h("div#drawblins.mode", s(page));
}
/*function setRecap() {
	if (rounds.length === 0) {
		return;
	} else if (rounds.length === 1 && rounds[0].) {
		
	}
}
function recapView() {
	return h("!");
}*/

function Starting() {
	return h(
		"div#starting.tab",
		h("h1", "Game Starting!")
	);
}
function Drawing(secsLeft: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players(), secsLeft, Shared.DRAWING_BUFFER_SECS);
	
	defer(INC.subscribe("drawingSubmitted", ({ playerId, drawing }) => {
		currentRound().handleDrawing(playerId, drawing);
		readyDisplay.ready(playerId);
	}));
	
	return h(
		"div#drawing.tab",
		[
			h("h2", "Draw a creature named..."),
			h("h1", currentRound().goblinName),
			readyDisplay.View()
		]
	);
}
function Voting(secsLeft: number) {
	
	const voteQueue = new Room.VoteQueue();
	const readyDisplay = new ReadyDisplay(Room.players(), secsLeft, Shared.VOTING_BUFFER_SECS);
	const round = currentRound();
	//let showing = false;
	
	defer(
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			currentRound().handleVote(playerId, forId);
			readyDisplay.ready(playerId);
		}),
		INC.subscribe("showingVotes", () => {
			const votes = round.votesReceived;
			// Increase scores
			for (const id of Room.playerIds())
				scores.add(id, votes[id]?.length ?? 0);
			// Start revealing votes
			voteQueue.start(votes);
			readyDisplay.stopCountdown();
		})
	);
	return h("div#voting.tab", [
		h("div", `Vote for your favorite ${round.goblinName}!`),
		s(voteQueue.update, () => {
			let submissions: VNode[] = [];
			for (const [id, player] of Room.playerMap) {
				const drawing = round.drawings[id];
				if (drawing !== undefined) {
					const voteIds = voteQueue.get(id);
					const votes = Room.players(voteIds);
					submissions.push(Submission(player, { drawing }, { votes }));
				}
			}
			return SubmissionGrid(submissions)
		}),
		readyDisplay.View()
	]);
}
function ShowingScores() {
	return h(
		"div#showing-scores.tab",
		[
			h("h1", "Scores"),
			h("h2", `Round ${rounds.length}/${mode.setting("roundCount")}`),
			scores.View()
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











