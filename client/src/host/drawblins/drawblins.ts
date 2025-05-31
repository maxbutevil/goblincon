

import {
	Signal, //State,
	Val, ReceiveIndex, SendIndex,
	h, s, Micron,
	
	Shared, client
} from "../../modules"

import Room from "../room"
import settings from "./settings"
import { Player } from "../data"
import { Game } from "./data"
import { Mode, Setting } from "../mode"
import { Submission, SubmissionGrid, ReadyDisplay, VoteQueue } from "../components"


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


const page = Micron.projector(Starting);


export default function View() {
	
	Game.init(Room.players);
	
	Micron.defer(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, secsLeft }) => {
			Game.pushRound(goblinName);
			page.put(Drawing, secsLeft);
		}),
		INC.subscribe("voting", ({ secsLeft }) => page.put(Voting, secsLeft)),
		INC.subscribe("showingScores", () => page.put(ShowingScores)),
	);
	
	return h("div#drawblins.mode", s(page));
}

export const test = Micron.test("drawblins")
	.add(Starting)
	.add(Drawing, 120)
	.create(() => {
		Game.init(Room.players);
		Game.pushRound("Test Goblin Name");
	});
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
		"div#starting.page",
		h("h1", "Game Starting!")
	);
}
function Drawing(secsLeft: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players.array(), secsLeft, Shared.DRAWING_BUFFER_SECS);
	
	Micron.defer(INC.subscribe("drawingSubmitted", ({ playerId, drawing }) => {
		Game.handleDrawing(playerId, drawing);
		readyDisplay.ready(playerId);
	}));
	
	return h("div#drawing.page", [
		h("div.flow", [
			h("h2", "Draw a creature named..."),
			h("h1", Game.currentRound().goblinName),
		]),
		readyDisplay.View()
	]);
}
function Voting(secsLeft: number) {
	
	const voteQueue = new VoteQueue();
	const readyDisplay = new ReadyDisplay(Room.players.array(), secsLeft, Shared.VOTING_BUFFER_SECS);
	const round = Game.currentRound();
	//let showing = false;
	
	Micron.defer(
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			Game.handleVote(playerId, forId);
			readyDisplay.ready(playerId);
		}),
		INC.subscribe("showingVotes", () => {
			const votes = round.votesReceived;
			// Increase scores
			for (const id of Room.players.ids())
				Game.players.addScore(id, votes[id]?.length ?? 0);
			// Start revealing votes
			voteQueue.start(votes);
			readyDisplay.stopCountdown();
		})
	);
	return h("div#voting.page", [
		h("div", `Vote for your favorite ${round.goblinName}!`),
		s(voteQueue.update, () => {
			let submissions: Micron.Node[] = [];
			for (const player of Game.players.iter()) {
				const id = player.id;
				const drawing = round.drawings[id];
				if (drawing !== undefined) {
					const voteIds = voteQueue.get(id);
					const votes = Room.players.query(voteIds);
					submissions.push(Submission(player, { drawing }, { votes }));
				}
			}
			return SubmissionGrid(submissions)
		}),
		readyDisplay.View()
	]);
}
function ShowingScores() {
	return h("div#showing-scores.page", [
		h("h1", "Scores"),
		h("h2", `Round ${Game.rounds.length}/${settings.get("roundCount")}`),
		Game.players.ScoreView()
	]);
}













