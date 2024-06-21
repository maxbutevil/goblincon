class_name PlayerIcons
extends Control

#const PLAYER_ICON:= preload("res://Scenes/Instances/player_icon.tscn");

#func _ready():
	#
	#Client.player_joined.connect(
		#func(id: int, player: Player):
			#var icon: PlayerIcon = PLAYER_ICON.instantiate();
			#icon.set_player_name(player.name);
			#add_child(icon);
	#);
	#Client.game_terminated.connect(
		#func():
			#for child in get_children():
				#remove_child(child);
				#child.queue_free();
	#);

