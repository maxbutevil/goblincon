

import {
	Signal, //State,
	Val, ReceiveIndex, SendIndex,
	h, s, Micron,
	
	Shared, client
} from "../../modules"

import Room from "../room"
import settings from "./settings"
import { Player } from "../data"
import { Game, Round } from "./data"
import { Mode, Setting } from "../mode"
import { Submission, SubmissionGrid, ReadyDisplay, VoteQueue, Recap } from "../components"
import * as assets from "../../assets/testing"


const INC = new ReceiveIndex({
	"drawing": { endMillis: Val.NUM, goblinName: Val.STR },
	"voting": { endMillis: Val.NUM },
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
		setRecap,
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, endMillis }) => {
			Game.pushRound(goblinName);
			page.put(Drawing, endMillis);
		}),
		INC.subscribe("voting", ({ endMillis }) => page.put(Voting, endMillis)),
		INC.subscribe("showingScores", () => page.put(ShowingScores)),
	);
	
	return h("div#drawblins.mode", s(page));
}





export const test = Micron.test("drawblins")
	.add(Starting)
	.add(Drawing, 120)
	.add(Voting, 30)
	//.add(Recap)
	.create(() => {
		//Room.mock(8);
		Game.init(Room.players);
		Game.pushRound("Test Goblin Name");
		Game.handleDrawing(0, assets.legsLord);
		Game.handleDrawing(1, assets.sadSack);
		Game.handleDrawing(2, assets.licensedTherapist);
		Game.handleDrawing(3, assets.topHatEnthusiast);
		Game.handleDrawing(4, assets.legsLord);
		Game.handleDrawing(5, assets.sadSack);
		Game.handleDrawing(6, assets.licensedTherapist);
		//Game.handleDrawing(7, assets.topHatEnthusiast);
		Game.handleVote(0, 1);
		Game.handleVote(1, 0);
		Game.handleVote(2, 0);
		Game.handleVote(3, 2);
		setRecap();
	});
function setRecap() {
	if (needsRecap()) {
		Room.setResults({
			players: Game.players,
			recap: DrawblinsRecap
		});
	} else {
		Room.clearResults();
	}
}
function needsRecap() {
	for (const round of Game.rounds) {
		if (round.drawings.length > 0) {
			return true;
		}
	}
	return false;
}
function DrawblinsRecap(close: () => void) {
	
	const players = Game.players;
	
	function RoundRecap(round: Round, i: number) {
		if (round.drawings.length === 0) {
			return h("!");
		}
		
		return h("div.drawblins-round", [
			h("h2", `Round ${i + 1}: ${round.goblinName}`),
			h("div.submissions", [
				...round.drawings.map((drawing, id) => {
					return Submission(
						players.get(id)!,
						{ drawing }
					);
				})
			])
		]);
	}
	
	return Recap(
		"Recap - Drawing Mode",
		Game.rounds.map(RoundRecap),
		close
	);
}

function Starting() {
	return h(
		"div#starting.page",
		h("h1", "Game Starting!")
	);
}
function Drawing(endMillis: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players.array(), endMillis, Shared.DRAWING_BUFFER_SECS);
	
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
function Voting(endMillis: number) {
	
	// Maybe skip animations if something goes wrong and only a small amount of time is left
	const DELAY_INITIAL = 0.2;
	const DELAY_STAGGER = 1.5;
	
	const voteQueue = new VoteQueue();
	const readyDisplay = new ReadyDisplay(Room.players.array(), endMillis, Shared.VOTING_BUFFER_SECS);
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
		h("div",
			{ style: { fontSize: "1.2em"} },
			`Vote for your favorite ${round.goblinName}!`
		),
		s(voteQueue.update, () => {
			let submissions: Micron.Node[] = [];
			for (const player of Game.players.iter()) {
				const id = player.id;
				const drawing = round.drawings[id];
				if (drawing !== undefined) {
					const voteIds = voteQueue.get(id);
					const votes = Room.players.query(voteIds);
					const delay = DELAY_INITIAL + submissions.length * DELAY_STAGGER;
					submissions.push(Submission(player, { drawing }, { votes, delay }));
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













