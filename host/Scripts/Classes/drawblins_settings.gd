class_name DrawblinsSettings
extends GameSettings

var round_count:= Setting.new([1, 2, 3, 5, 8], 2);
var draw_time_factor:= Setting.new(GameSettings.TIME_FACTOR_CHOICES, 2);
var vote_time_factor:= Setting.new(GameSettings.TIME_FACTOR_CHOICES, 2);

func as_remote() -> Dictionary:
	return {
		game = "drawblins",
		settings = {
			roundCount = round_count.get_choice(),
			drawTimeFactor = draw_time_factor.get_choice(),
			voteTimeFactor = vote_time_factor.get_choice()
		}
	};






