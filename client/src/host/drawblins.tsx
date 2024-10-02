


import Signal from "../modules/signal"
import State from "../modules/state"
import { Enum, Variant } from "../modules/variant"
import Extract, { ReceiveIndex, SendIndex } from "../modules/extract"
import client from "../client"
import * as Utils from "../utils"
import * as Room from "./room"
import React from "react"
import { Setting, SettingMultiSelect, SettingsRemoteOf, toRemote } from "./setting"
//import { motion } from "framer-motion"

const INC = new ReceiveIndex({
	"gameStarted": Extract.NONE,
	"drawing": { goblinName: Extract.STRING },
	"voting": Extract.NONE,
	"results": Extract.NONE,
	"scoring": Extract.NONE,
	"drawingSubmitted": { playerId: Extract.NUMBER, drawing: Extract.STRING },
	"voteSubmitted": { playerId: Extract.NUMBER, forId: Extract.NUMBER }
});
const OUT = new SendIndex({
	"terminate": Extract.NONE
});

type Page = 
	Variant<"starting"> |
	Variant<"drawing"> |
	Variant<"voting"> |
	Variant<"scoring">;
const page = new State<Page>(Enum.unit("starting"));
const voteRevealed = new Signal<number>();

const settings = {
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
export function SettingSelect() {
	return <SettingMultiSelect settings={settings} />;
}


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
	page.set(Enum.unit("drawing"));
});
INC.listen("voting", () => page.set(Enum.unit("voting")));
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
INC.listen("scoring", () => page.set(Enum.unit("scoring")));
INC.listen("drawingSubmitted", ({ playerId, drawing }) => {
	currentRound().handleDrawing(playerId, drawing);
});
INC.listen("voteSubmitted", ({ playerId, forId }) => {
	currentRound().handleVote(playerId, forId);
});

export function init() {
	rounds = [];
	scores = [];
	page.set(Enum.unit("starting"));
	return client.use(INC, OUT);
}
export function Component() {
	const { key } = Utils.useExternal(page);
	switch(key) {
		case "starting": return <Starting />;
		case "drawing": return <Drawing />;
		case "voting": return <Voting />;
		case "scoring": return <Scoring />;
	}
}
function Starting() {
	return (
		<div className="tab">
			<h1>Starting!</h1>
		</div>
	);
}
function Drawing() {
	return (
		<div className="tab">
			<h2>Draw a creature named...</h2>
			<h1>{currentRound().goblinName}</h1>
		</div>
	);
}
function Voting() {
	return (
		<div className="tab">
			<div>Vote for your favorite {currentRound().goblinName}!</div>
			<div className="submission-ctr">
				{Room.playerIds().map(id => <Submission key={id} playerId={id} />)}
				{Room.playerIds().map(_ => <div className="submission-placeholder"></div>)}
			</div>
		</div>
	);
}
function Scoring() {
	
	let sortedIds = Room.playerIds().sort((a, b) => {
		return getScore(b) - getScore(a);
	});
	
	let entries: JSX.Element[] = [];
	let rank = 1;
	for (let i = 0; i < sortedIds.length; i++) {
		let id = sortedIds[i], score = getScore(id), name = Room.playerName(id) ?? "";
		// If score is tied with the previous player, their rank is the same
		if (i > 0 && score < getScore(sortedIds[i-1]))
			rank = i+1;
		entries.push(<ScoreEntry key={id} rank={rank} name={name} score={score} />);
	}
	
	return (
		<div className="tab">
			<h1>Scores</h1>
			<div className="score-entry-ctr">
				{entries}
			</div>
		</div>
	);
}
function Submission({ playerId }: { playerId: number }) {
	
	const playerName = Room.playerName(playerId);
	const drawing = currentRound().drawings[playerId];
	
	let [voteCount, setVoteCount] = React.useState(0);
	React.useEffect(() => voteRevealed.subscribe((player) => {
		//console.log(player, playerId);
		if (player === playerId)
			setVoteCount(voteCount + 1);
	})); // this needs to rebuild since it references voteCount
	
	if (playerName === undefined || drawing === undefined)
		return <></>;
	
	let voteIcons = [];
	for (let i = 0; i < voteCount; i++)
		voteIcons.push(<VoteIcon key={i} index={i} />)
	
	return (
		<div className="submission">
			<img src={drawing} />
			<div className="player-name">{playerName}</div>
			<div className="vote-ctr">{voteIcons}</div>
		</div>
	);
}
function ScoreEntry({ rank, name, score }: { rank: number, name: string, score: number }) {
	return (
		<div className="score-entry">
			<span className="name">{rank}. {name}</span>
			<span className="score">{score}</span>
		</div>
	);
}
function VoteIcon({ index }: { index: number }) {
	
	return (
		<div className="vote-icon fade-in"
			//initial={{ scale: 0.0 }}
			//animate={{ scale: 1.0 }}
		>
			
		</div>
	);
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











