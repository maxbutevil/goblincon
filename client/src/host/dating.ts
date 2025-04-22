


import {
	Shared,
	//Signal,
	Val, ReceiveIndex, SendIndex,
	h, s, defer, projector, VNode,
	
	client,
	Signal
} from "../modules"

import * as Room from "./room"
import { Player, ScoreMap } from "./room"
import { Mode, Setting } from "./mode"
import { SubmissionData, SUBMISSION_DATA } from "../modules/submission_data"
import { Suitor, Matchup, Round } from "./dating_data"

import {
	Countdown,
	IdlePage
} from "../components"
import {
	Submission,
	ReadyDisplay
} from "./components"
import * as icons from "../assets/icons"
import { DRAWING_BUFFER_SECS } from '../modules/shared';


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

const mode = new Mode("dating", view, {
	roundCount: new Setting(
		"Number of Rounds",
		[ 1, 2, 3 ],
		{ key: "datingRoundCount" }
	),
	naming: Setting.boolean(
		"Creature Naming",
		{ key: "datingNaming", initial: true }
	),
	bachelorDrawTimeFactor: Setting.multiplier(
		"Bachelor Drawing Time",
		[ 0.5, 0.8, 1.0, 1.3, 2.0 ],
		{ key: "datingBachelorDrawTimeFactor" }
	),
	suitorDrawTimeFactor: Setting.multiplier(
		"Suitor Drawing Time",
		[ 0.5, 0.8, 1.0, 1.3, 2.0 ],
		{ key: "datingSuitorDrawTimeFactor" }
	),
	voteTimeFactor: Setting.multiplier(
		"Voting Time",
		[ 0.5, 0.8, 1.0, 1.3, 2.0 ],
		{ key: "datingVoteTimeFactor" }
	),
	scoreTimeFactor: Setting.multiplier(
		"Scoring Time",
		[0.7, 1.0, 1.3],
		{ key: "datingScoreTimeFactor" }
	)
	//keepScores: Setting.multiplier("")
});

export default mode;

let rounds: Round[] = [];
let scores = new ScoreMap();
function currentRound(): Round { return rounds.at(-1)!; }

const page = projector(Starting);

function view() {
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawingBachelors", ({ theme, secsLeft }) => {
			rounds.push(new Round(theme));
			page.put(DrawingBachelors, theme, secsLeft);
		}),
		INC.subscribe("drawingSuitors", ({ secsLeft }) => page.put(DrawingSuitors, secsLeft)),
		INC.subscribe("showingScores", () => page.put(ShowingScores)),
		INC.subscribe("voting", ({ bachelorId, secsLeft }) => {
			currentRound().handleMatchup(bachelorId);
			page.put(Voting, bachelorId, secsLeft);
		}),
	);
	rounds = [];
	scores.reset();
	defer(setRecap);
	return h("div#dating.mode", s(page));
}

function Starting() {
	return IdlePage("Game Starting!", "(Dating Mode)", "Get ready to draw!");
}
function DrawingBachelors(theme: string, secsLeft: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players(), secsLeft, Shared.DRAWING_BUFFER_SECS);
	
	defer(INC.subscribe("bachelorSubmitted", ({ playerId, submission }) => {
		currentRound().handleBachelorSubmission(playerId, submission);
		readyDisplay.ready(playerId);
	}));
	
	return h("div#drawing-bachelors.tab", [
		h("h1", "Draw your Bachelor!"),
		h("h3", "Draw a creature that fits the theme:"),
		h("h2", theme),
		readyDisplay.View()
	]);
}
function DrawingSuitors(secsLeft: number) {
	
	const readyDisplay = new ReadyDisplay(Room.players(), secsLeft, Shared.DRAWING_BUFFER_SECS);
	for (const bachelorId of Room.playerIds()) {
		if (!currentRound().matchups.has(bachelorId)) {
			// this player didn't submit a bachelor, and therefore won't be submitting a suitor
			readyDisplay.ready(bachelorId);
		}
	}
	
	defer(
		INC.subscribe("suitorSubmitted", ({ playerId, bachelorId, submission }) => {
			currentRound().handleSuitorSubmission(bachelorId, playerId, submission);
			readyDisplay.ready(playerId);
		})
	);
	
	return h("div#drawing-suitors.tab", [
		h("h1", "Draw your Suitors!"),
		h("h2", "Draw creatures that would make good partners for the bachelors you have received"),
		readyDisplay.View()
	]);
}
function ShowingScores() {
	return h("div#showing-scores.tab", [
		h("h1", "Scores"),
		h("h2", `Round ${rounds.length}/${mode.setting("roundCount")}`),
		scores.View()
	]);
}
function Voting(bachelorId: number, secsLeft: number) {
	
	const round = currentRound();
	const matchup = round.matchup(bachelorId)!;
	const bachelor = Room.player(bachelorId)!;
	
	const voteQueue = new Room.VoteQueue();
	const readyDisplay = new ReadyDisplay(Room.players(), secsLeft, Shared.VOTING_BUFFER_SECS);
	for (const { id } of matchup.suitors) {
		// suitors won't be voting since their own submission is being voted on
		readyDisplay.ready(id);
	}
	
	// Ensure that suitors show up in the same order on host and in votes
	matchup.suitors.sort((a, b) => a.id - b.id);
	
	defer(
		INC.subscribe("voteSubmitted", ({ playerId, forId }) => {
			round.handleVote(bachelorId, playerId, forId);
			readyDisplay.ready(playerId)
		}),
		INC.subscribe("showingVotes", () => {
			// Increase scores
			for (const { id, points } of matchup.suitors)
				scores.add(id, points);
			
			// Start revealing votes
			const votes = matchup.suitors.map(suitor => suitor.votes);
			voteQueue.start(votes);
			readyDisplay.stopCountdown();
		})
	);
	
	return h("div#voting.tab", [
		s(voteQueue.update, () => {
			
			let bachelorDrawing = Submission(bachelor, matchup.bachelorSubmission);
			
			let suitorDrawings = matchup.suitors.map(({ id, submission: _submission }, index) => {
				const votes = voteQueue.get(index).map(id => Room.player(id)!);
				return Submission(Room.player(id)!, _submission, { votes });
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

function setRecap() {
	let needsRecap = false;
	for (const round of rounds) {
		if (round.matchups.size > 0) {
			needsRecap = true;
			break;
		}
	}
	
	if (needsRecap) {
		Room.setRecap(RecapOverlay);
	}
}
function RecapOverlay(close: () => void) {
	
	function MatchupRecap(matchup: Matchup): VNode {
		const { bachelorId, bachelorSubmission, suitors } = matchup;
		const bachelorNode = Submission(Room.player(bachelorId)!, bachelorSubmission);
		
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
				Submission(Room.player(s.id)!, s.submission),
				spacer(),
			]);
		} else if (suitors.length === 2) {
			const [s1, s2] = suitors;
			return h(sel, [
				Submission(Room.player(s1.id)!, s1.submission),
				icon(s1.points - s2.points),
				bachelorNode,
				icon(s2.points - s1.points),
				Submission(Room.player(s2.id)!, s2.submission)
			]);
		} else {
			console.error("attempted to create recap for matchup with more than 2 suitors")
			return h("!");
		}
	}
	function RoundRecap(round: Round, i: number): VNode | null {
		const matchups = round.sortedMatchups();
		if (matchups.length === 0) {
			return null;
		} else {
			return h("div.round", [
				h("h2", `Round ${i+1}: ${round.theme}`),
				...matchups.map(MatchupRecap)
			]);
		}
	}
	
	return h("div#overlay", [
		h("div#dating-recap.popup", [
			h("div#recap", [
				h("h1", "Recap"),
				...rounds.map(RoundRecap),
			]),
			h("button",
				{ on: { click: close } },
				"Close"
			)
		])
	]);
}



