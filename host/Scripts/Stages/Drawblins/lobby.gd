extends Control

@onready var settings_container:= $SettingsContainer;

func _ready():
	
	var setting_buttons: Array[SettingButton] = [
		SettingButton.new(
			Drawblins.settings.round_count,
			"Round Count\n%s",
		),
		SettingButton.new(
			Drawblins.settings.draw_time_factor,
			"Draw Time\n%3.1fx"
		),
		SettingButton.new(
			Drawblins.settings.vote_time_factor,
			"Vote Time\n%3.1fx"
		),
	];
	
	for button in setting_buttons:
		settings_container.add_child(button);
	

