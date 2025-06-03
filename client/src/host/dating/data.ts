

import { Player, PlayerMap } from "../data"
import { h, Micron } from "../../modules"
import { SubmissionData } from "../../modules/data";


export type { SubmissionData };
export type Suitor = {
	id: number,
	submission: SubmissionData,
	votes: number[],
	points: number
};
export class Matchup {
	bachelorId: number;
	bachelorSubmission: SubmissionData;
	suitors: Suitor[] = [];
	
	constructor(bachelorId: number, bachelorSubmission: SubmissionData) {
		this.bachelorId = bachelorId;
		this.bachelorSubmission = bachelorSubmission;
	}
	
	suitor(suitorId: number): Suitor | undefined {
		for (const suitor of this.suitors)
			if (suitor.id === suitorId) return suitor;
	}
	/*winner(): Suitor | undefined {
		let winner: Suitor | undefined = undefined;
		let winnerPoints = -1;
		for (const suitor of this.suitors) {
			if (suitor.points > winnerPoints) {
				winner = suitor;
				winnerPoints = suitor.points;
			} else if (suitor.points === winnerPoints) {
				winner = undefined; // tied, no clear winner
			}
		}
		return winner;
	}*/
}
export class Round {
	theme: string;
	matchups = new Map<number, Matchup>();
	matchupOrder: number[] = [];
	
	constructor(theme: string) {
		this.theme = theme;
	}
	
	matchup(bachelorId: number): Matchup | undefined {
		return this.matchups.get(bachelorId);
	}
	sortedMatchups(): Matchup[] {
		return this.matchupOrder.map(m => this.matchups.get(m)!);
	}
}
export class Game {
	
	players: PlayerMap;
	rounds: Round[] = [];
	
	private constructor(players: PlayerMap) {
		players.resetScores();
		this.players = players;
	}
	
	private static current: Game;
	static get players() {
		return this.current.players;
	}
	static get rounds() {
		return this.current.rounds;
	}
	
	static get(): Game {
		return this.current;
	}
	static init(players: PlayerMap) {
		this.current = new Game(players.clone());
	}
	static currentRound(): Round {
		return this.rounds.at(-1)!;
	}
	static pushRound(theme: string) {
		this.rounds.push(new Round(theme));
	}
	static handleBachelor(playerId: number, submission: SubmissionData) {
		const round = this.currentRound();
		const matchup = new Matchup(playerId, submission);
		round.matchups.set(playerId, matchup);
	}
	static handleSuitor(bachelorId: number, playerId: number, submission: SubmissionData) {
		const round = this.currentRound();
		const matchup = round.matchups.get(bachelorId);
		if (!matchup) {
			console.error("invalid bachelor id for suitor drawing submission");
			return;
		}
		if (matchup.suitors.length >= 2) {
			console.error("adding suitor to matchup that already has two or more suitors");
		}
		matchup.suitors.push({ id: playerId, submission, votes: [], points: 0 });
	}
	static handleVote(bachelorId: number, playerId: number, forId: number) {
		const round = this.currentRound();
		const matchup = round.matchups.get(bachelorId);
		if (!matchup) return console.error(`invalid bachelorId for vote: ${bachelorId} -> ${forId}`);
		const suitor = matchup.suitor(forId);
		if (!suitor) return console.error(`invalid suitorId for vote: ${bachelorId} -> ${forId}`);

		// Bachelor's vote is worth 3 points, everyone else's is worth 2
		suitor.points += bachelorId === playerId ? 3 : 2;
		suitor.votes.push(playerId);
	}
	static handleMatchup(bachelorId: number) {
		const round = this.currentRound();
		if (!round.matchups.has(bachelorId)) {
			console.error("matchup not found for given bachelorId");
			return;
		}
		round.matchupOrder.push(bachelorId);
	}
	
	/*hasRecap(): boolean {
		
	}
	Recap(): Micron.Node {
		
	}*/
	
	
}







