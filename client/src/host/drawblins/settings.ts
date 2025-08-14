
import { Setting, Settings } from "../mode"


export default new Settings({
  roundCount: new Setting(
    "Number of Rounds",
    [1, 2, 3, 5, 8],
    { key: "drawblinsRoundCount" }
  ),
  drawTimeFactor: Setting.multiplier(
    "Drawing Time",
    [0.5, 0.8, 1.0, 1.3, 2.0],
    { key: "drawblinsDrawTimeFactor" }
  ),
  voteTimeFactor: Setting.multiplier(
    "Voting Time",
    [0.5, 0.8, 1.0, 1.3, 2.0],
    { key: "drawblinsVoteTimeFactor" }
  ),
  scoreTimeFactor: Setting.multiplier(
    "Scoring Time",
    [0.8, 1.0, 1.3],
    { key: "drawblinsScoreTimeFactor" }
  )
}, {
  "Default": {
    "drawTimeFactor": 1.0,
    "voteTimeFactor": 1.0,
    "scoreTimeFactor": 1.0,
    "roundCount": 2
  },
});

