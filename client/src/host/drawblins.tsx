


import Signal from "../modules/signal"
import State from "../modules/state"
import { Enum, Variant } from "../modules/variant"
import Extract, { ReceiveIndex, SendIndex } from "../modules/extract"
import client from "../client"
import * as Utils from "../utils"
import * as Room from "./room"
import React from "react"

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
	Variant<"results">;
const page = new State<Page>(Enum.unit("starting"));

let scores: number[];
let rounds: Round[];
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
//INC.listen("scoring", () => page.set)
INC.listen("results", () => page.set(Enum.unit("results")));
INC.listen("drawingSubmitted", ({ playerId, drawing }) => {
	currentRound().handleDrawing(playerId, drawing);
});
INC.listen("voteSubmitted", ({ playerId, forId }) => {
	currentRound().handleVote(playerId, forId);
});

export function init() {
	return client.use(INC, OUT);
}
export function Component() {
	const { key } = Utils.useExternal(page);
	switch(key) {
		case "starting": return <Starting />;
		case "drawing": return <Drawing />;
		case "voting": return <Voting />;
		case "results": return <Results />;
	}
}
function Starting() {
	return (
		<div className="tab">
			<h1>Starting</h1>
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
	
	const rerender = Utils.useForceRerender();
	React.useCallback(() => {
		return INC.subscribe("results", () => {
			/* Todo: Show votes */
			let round = currentRound();
			for (const id of Room.playerIds()) {
				addScore(id, round.voteCounts[id] ?? 0);
			}
		})
	}, []);
	
	return (
		<div className="tab">
			<div>Vote for your favorite {currentRound().goblinName}!</div>
			<div className="submission-ctr">
				{Room.playerIds().map(id => <Submission playerId={id} />)}
			</div>
		</div>
	);
}
function Results() {
	
	let sortedIds = Room.playerIds().sort((a, b) => {
		return getScore(b) - getScore(a);
	});
	
	let entries: JSX.Element[] = [];
	for (let i = 0; i < sortedIds.length; i++) {
		entries.push(<ScoreEntry playerId={sortedIds[i]} rank={i+1} />);
	}
	
	return (
		<div className="tab">
			<div className="score-entry-ctr">
				{entries}
			</div>
		</div>
	);
}
function Submission({ playerId }: { playerId: number }) {
	
	const playerName = Room.playerName(playerId);
	const drawing = currentRound().drawings[playerId];
	
	if (playerName === undefined || drawing === undefined)
		return <></>;
	
	return (
		<div className="submission">
			<img src={drawing}></img>
			<div className="player-name">{playerName}</div>
		</div>
	);
}
function ScoreEntry({ playerId, rank }: { playerId: number, rank: number }) {
	return (
		<div className="score-entry">
			<span className="name">{rank}. {Room.playerName(playerId)}</span>
			<span className="score">{getScore(playerId)}</span>
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
		this.votes[forId] = 1 + (this.votes[forId] ?? 0);
	}
}











