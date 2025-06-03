
import {
  h, Micron,
  Shared, playerIcons,
  
} from "../modules";

export class Player {
  readonly id: number;
  readonly name: string;
  icon: number;
  score: number;
  
  get color() { return Shared.playerColor(this.id); }
  constructor(id: number, name: string, icon: number, score = 0) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.score = score;
  }
  static mock(i: number): Player {
    return new Player(i, `TestPlayer #${i}`, i % 7);
  }
  
  clone(): Player {
    return new Player(this.id, this.name, this.icon, this.score);
  }
  
  IconView(disabled = false) {
    return playerIcons.View(this.icon, this.color, disabled);
  }
  
  View(disabled = false) {
    return h("div.player-view", [
      this.IconView(disabled),
      h("div.name", this.name)
    ]);
  }
  ScoredView() {
    return h("div.player-view", [
      this.IconView(),
      h("div.name", this.name),
      h("div.score",`${this.score}pts`),
    ]);
  }
}

export class PlayerMap {
  
  protected players = new Map<number, Player>();
  
  static mock(playerCount: number): PlayerMap {
    const map = new PlayerMap();
    for (let i = 0; i < playerCount; i++)
      map.add(Player.mock(i));
    return map;
  }
  clone(): PlayerMap {
    const clone = new PlayerMap();
    for (const player of this.iter()) {
      clone.add(player);
    }
    return clone;
  }
  
  get count() {
    return this.players.size;
  }
  has(id: number): boolean {
    return this.players.has(id);
  }
  get(id: number): Player | undefined {
    return this.players.get(id);
  }
  add(player: Player) {
    this.players.set(player.id, player);
  }
  remove(id: number) {
    this.players.delete(id);
  }
  clear() {
    this.players.clear();
  }
  
  ids(): IterableIterator<number> {
    return this.players.keys();
  }
  iter(): IterableIterator<Player> {
    return this.players.values();
  }
  array(): Player[] {
    return Array.from(this.iter());
  }
  query(ids: number[]): Player[] {
    const players = [];
    for (const id of ids) {
      const player = this.get(id);
      if (!player) {
        console.error("player not found");
      } else {
        players.push(player);
      }
    }
    return players;
  }
  addScore(id: number, points: number): boolean {
    const player = this.get(id);
    if (player) {
      player.score += points;
      return true;
    }
    return false;
  }
  getScore(id: number): number {
    const player = this.get(id);
    if (!player) {
      console.error("attempted to retrieve score for player that is not present:", id);
      return 0;
    } else {
      return player.score;
    }
  }
  resetScores() {
    for (const player of this.iter()) {
      player.score = 0;
    }
  }
  
  /*sortedIds(): number[] {
    return Array.from(this.ids()).sort((a, b) => {
      return this.getScore(b) - this.getScore(a);
    });
  }*/
  sorted(): Player[] {
    return this.array().sort((a, b) => {
      return b.score - a.score;
    });
  }
  ranked(): { rank: number, player: Player }[] {
    let i = 0, rank = 1, prevScore;
    const rankings = [];
    for (const player of this.sorted()) {
      const { score } = player;
      if (!prevScore) {
        prevScore = score;
      } else {
        // If score is tied with that of the previous player, their rank is the same
        // Otherwise, increase it
        if (score !== prevScore)
          rank = i + 1;
      }
			
      rankings.push({ rank, player });
      prevScore = score;
    }
    return rankings;
  }
  
  ScoreView() {
    const entries = this.sorted().map(p => p.ScoredView());
    return h("div.score-entry-ctr.flow", entries);
  }
  
}

/*class Recap {

  readonly close = new Micron.Signal();

}*/

/*export interface GameBase {
  hasRecap: () => boolean,
  getRecap: Micron.Builder
};

class GameBase {
  players: PlayerMap;
  
  
  constructor(players: PlayerMap) {
    this.players = new PlayerMap();
  }
}
class GameManager<G extends GameBase> {
  current?: G;
}*/



