
import { Player, PlayerMap } from "../data"

export class Round {
  goblinName: string;
  drawings: string[] = [];
  votesSent: number[] = [];
  votesReceived: number[][] = [];
  constructor(goblinName: string) {
    this.goblinName = goblinName;
  }
}

export class Game {
  
  players: PlayerMap;
  rounds: Round[] = [];
  private constructor(players: PlayerMap) {
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
  
  static currentRound() {
    return this.rounds.at(-1)!;
  }
  static pushRound(goblinName: string) {
    this.rounds.push(new Round(goblinName));
  }
  static handleDrawing(playerId: number, drawing: string) {
    const round = this.currentRound();
    round.drawings[playerId] = drawing;
  }
  static handleVote(playerId: number, forId: number) {
    const round = this.currentRound();
    round.votesSent[playerId] = forId;
    (round.votesReceived[forId] ??= []).push(playerId);
  }
}


