


import { Setting, Settings } from "../mode"

export default new Settings({
  roundCount: new Setting(
    "Number of Rounds",
    [1, 2, 3],
    { key: "datingRoundCount" }
  ),
  bachelorDrawTimeFactor: Setting.multiplier(
    "Bachelor Draw Time",
    [0.5, 0.8, 1.0, 1.3, 2.0],
    { key: "datingBachelorDrawTimeFactor" }
  ),
  suitorDrawTimeFactor: Setting.multiplier(
    "Suitor Draw Time",
    [0.5, 0.8, 1.0, 1.3, 2.0],
    { key: "datingSuitorDrawTimeFactor" }
  ),
  voteTimeFactor: Setting.multiplier(
    "Voting Time",
    [0.5, 0.8, 1.0, 1.3, 2.0],
    { key: "datingVoteTimeFactor" }
  ),
  scoreTimeFactor: Setting.multiplier(
    "Scoring Time",
    [0.8, 1.0, 1.3],
    { key: "datingScoreTimeFactor" }
  ),
  naming: Setting.boolean(
    "Creature Naming",
    { key: "datingNaming", initial: true }
  ),
}, {
  "Default": {
    "naming": true,
    "bachelorDrawTimeFactor": 1.0,
    "suitorDrawTimeFactor": 1.0,
    "voteTimeFactor": 1.0,
    "scoreTimeFactor": 1.0,
    "roundCount": 2,
  }
});



