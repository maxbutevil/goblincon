


import {
	Shared,
	//Signal,
	Val, ReceiveIndex, SendIndex,
	h, s, Micron,
	
	client,
	Signal
} from "../../modules"

import Room from "../room"
import { Player, PlayerMap } from "../data"
import { SubmissionData, SUBMISSION_DATA } from "../../modules/data"
import { Suitor, Matchup, Round, Game } from "./data"
import settings from "./settings"

import {
	Countdown,
	IdlePage
} from "../../components"
import {
	Submission,
	ReadyDisplay,
	VoteQueue
} from "../components"
import * as icons from "../../assets/icons"
import { DRAWING_BUFFER_SECS } from '../../modules/shared';

const INC = new ReceiveIndex({
	"drawingBachelors": { theme: Val.STR, secsLeft: Val.NUM },
	"drawingSuitors": { secsLeft: Val.NUM },
	"voting": { bachelorId: Val.NUM, secsLeft: Val.NUM },
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
	
	"bachelorSubmitted": { submission: SUBMISSION_DATA, playerId: Val.NUM },
	"suitorSubmitted": { submission: SUBMISSION_DATA, playerId: Val.NUM, bachelorId: Val.NUM },
	"voteSubmitted": { playerId: Val.NUM, forId: Val.NUM },
});
const OUT = new SendIndex({
	/* Nothing */
});

const page = Micron.projector(Starting);

export default function View() {
	
	Game.init(Room.players);
	
	Micron.defer(
		setRecap,
		client.use(INC, OUT),
		INC.subscribe("drawingBachelors", ({ theme, secsLeft }) => {
			Game.pushRound(theme);
			//rounds.push(new Round(theme));
			page.put(DrawingBachelors, theme, secsLeft);
		}),
		INC.subscribe("drawingSuitors", ({ secsLeft }) => page.put(DrawingSuitors, secsLeft)),
		INC.subscribe("showingScores", () => page.put(ShowingScores)),
		INC.subscribe("voting", ({ bachelorId, secsLeft }) => {
			Game.handleMatchup(bachelorId);
			//currentRound().handleMatchup(bachelorId);
			page.put(Voting, bachelorId, secsLeft);
		}),
	);
	
	return h("div#dating.mode", s(page));
}
export const test = Micron.test("dating")
	.add(Starting)
	.add(DrawingBachelors, "testTheme", 120)
	.add(DrawingSuitors, 120)
	.add(ShowingScores)
	.create(() => {
		Game.init(Room.players);
		Game.pushRound("testTheme");
	});

function setRecap() {
	let needsRecap = false;
	for (const round of Game.rounds) {
		if (round.matchups.size > 0) {
			needsRecap = true;
			break;
		}
	}

	if (needsRecap) {
		Room.setRecap(Recap);
	} else {
		Room.clearRecap();
	}
}
function Recap(close: () => void) {

	function MatchupRecap(matchup: Matchup): Micron.Node {
		const { bachelorId, bachelorSubmission, suitors } = matchup;
		const bachelorNode = Submission(Game.players.get(bachelorId)!, bachelorSubmission);

		function spacer() {
			return h("div.spacer");
		}
		function icon(delta: number) {
			let src;
			if (delta > 0) {
				src = icons.heart;
			} else if (delta < 0) {
				src = icons.heartbreak;
			} else {
				src = icons.questionMark;
			}
			return h("img", { attrs: { src } });
		}

		const sel = "div.matchup";
		if (suitors.length === 0) {
			return h(sel, [
				spacer(),
				spacer(),
				bachelorNode,
				spacer(),
				spacer(),
			]);
		}
		else if (suitors.length === 1) {
			const [s] = suitors;
			return h(sel, [
				spacer(),
				bachelorNode,
				icon(s.points), // question mark if no points, otherwise heart
				Submission(Game.players.get(s.id)!, s.submission),
				spacer(),
			]);
		} else if (suitors.length === 2) {
			const [s1, s2] = suitors;
			return h(sel, [
				Submission(Game.players.get(s1.id)!, s1.submission),
				icon(s1.points - s2.points),
				bachelorNode,
				icon(s2.points - s1.points),
				Submission(Game.players.get(s2.id)!, s2.submission)
			]);
		} else {
			console.error("attempted to create recap for matchup with more than 2 suitors")
			return h("!");
		}
	}
	function RoundRecap(round: Round, i: number): Micron.Node | null {
		const matchups = round.sortedMatchups();
		if (matchups.length === 0) {
			return null;
		} else {
			return h("div.round", [
				h("h2", `Round ${i + 1}: ${round.theme}`),
				...matchups.map(MatchupRecap)
			]);
		}
	}

	return h("div#overlay", [
		h("div#dating-recap.popup", [
			h("div#recap", [
				h("h1", "Recap"),
				...Game.rounds.map(RoundRecap),
			]),
			h("button",
				{ on: { click: close } },
				"Close"
			)
		])
	]);
}

function Starting() {
	return IdlePage("Game Starting!", "(Dating Mode)", "Get ready to draw!");
}
function DrawingBachelors(theme: string, secsLeft: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players.array(), secsLeft, Shared.DRAWING_BUFFER_SECS);
	
	Micron.defer(INC.subscribe("bachelorSubmitted", ({ playerId, submission }) => {
		Game.handleBachelor(playerId, submission);
		readyDisplay.ready(playerId);
	}));
	
	return h("div#drawing-bachelors.page", [
		h("div.flow", [
			h("h1", "Draw your Bachelor!"),
			h("h3", "Draw a creature that fits the theme:"),
			h("h2", theme),
		]),
		readyDisplay.View()
	]);
}
function DrawingSuitors(secsLeft: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players.array(), secsLeft, Shared.DRAWING_BUFFER_SECS);
	for (const bachelorId of Game.players.ids()) {
		if (!Game.currentRound().matchups.has(bachelorId)) {
			// this player didn't submit a bachelor, and therefore won't be submitting a suitor
			readyDisplay.ready(bachelorId);
		}
	}
	
	Micron.defer(
		INC.subscribe("suitorSubmitted", ({ playerId, bachelorId, submission }) => {
			Game.handleSuitor(bachelorId, playerId, submission);
			readyDisplay.ready(playerId);
		})
	);
	
	return h("div#drawing-suitors.page", [
		h("div.flow", [
			h("h1", "Draw your Suitors!"),
			h("h2", "Draw creatures that would make good partners for the bachelors you have received"),
		]),
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
function Voting(bachelorId: number, secsLeft: number) {
	
	const round = Game.currentRound();
	const matchup = round.matchup(bachelorId)!;
	const bachelor = Game.players.get(bachelorId)!;
	
	const voteQueue = new VoteQueue();
	const readyDisplay = new ReadyDisplay(Room.players.array(), secsLeft, Shared.VOTING_BUFFER_SECS);
	for (const { id } of matchup.suitors) {
		// suitors won't be voting since their own submission is being voted on
		readyDisplay.ready(id);
	}
	
	// Ensure that suitors show up in the same order on host and in votes
	matchup.suitors.sort((a, b) => a.id - b.id);
	
	Micron.defer(
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			Game.handleVote(bachelorId, playerId, forId);
			readyDisplay.ready(playerId)
		}),
		INC.subscribe("showingVotes", () => {
			// Increase scores
			for (const { id, points } of matchup.suitors)
				Game.players.addScore(id, points);
			
			// Start revealing votes
			const votes = matchup.suitors.map(suitor => suitor.votes);
			voteQueue.start(votes);
			readyDisplay.stopCountdown();
		})
	);
	
	return h("div#voting.page", [
		s(voteQueue.update, () => {
			
			let bachelorDrawing = Submission(bachelor, matchup.bachelorSubmission);
			
			let suitorDrawings = matchup.suitors.map(({ id, submission: _submission }, index) => {
				const voteIds = voteQueue.get(index);
				const votes = Game.players.query(voteIds);
				return Submission(Game.players.get(id)!, _submission, { votes });
			});
			
			if (suitorDrawings.length === 2) {
				suitorDrawings = [
					suitorDrawings[0],
					h("img#vs-icon", { attrs: { src: icons.vs } }),
					suitorDrawings[1]
				]
			}
			
			return h("div.submission-ctr", [
				h("div.submission-row", bachelorDrawing),
				h("div.submission-row", suitorDrawings)
			]);
		}),
		readyDisplay.View()
	]);
}
