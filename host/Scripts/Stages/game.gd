class_name Game
extends StageMount

const MAIN_MENU:= preload("res://Scenes/Stages/main_menu.tscn");
#const LANDING:= preload("res://Scenes/Stages/landing.tscn");
const LOADING:= preload("res://Scenes/Stages/loading.tscn");
#const LOBBY:= preload("res://Scenes/Stages/Drawblins/lobby.tscn");
const DRAWBLINS:= preload("res://Scenes/Stages/Drawblins/drawblins.tscn");

@onready var status: Status = $%Status;

func to_main_menu():
	set_stage(MAIN_MENU.instantiate());
#func to_lobby():
	#set_stage(LOBBY.instantiate());
func to_mode(mode: Mode):
	set_stage(mode.create_stage());

func error():
	pass;

func _ready():
	
	#Client.accepted.connect(func(): print("Accepted! Join Code: ", Client.get_join_code()));
	#Client.terminated.connect(func(): print("Disconnected."));
	
	
	
	Client.connecting.connect(func(): set_stage(LOADING.instantiate()));
	Client.accepted.connect(
		func():
			to_mode(Client.get_mode());
	);
	#Client.mode_changed.connect(
		#func(old_mode: Mode, new_mode: Mode):
			#to_mode(new_mode);
	#);
	#Client.lobby_created.connect(
		#func():
			#match Client.mode:
				#Client.Mode.DRAWBLINS: set_stage(DRAWBLINS.instantiate());
				#_: printerr("No mode selected");
	#);
	#Client.game_started.connect(func(): to_mode(Client.get_mode()));
	Client.connection_failed.connect(
		func():
			to_main_menu();
			status.show_status("Connection Failed");
	);
	Client.terminated.connect(
		func(ok: bool):
			to_main_menu();
			if !ok:
				status.show_status("Fatal Server Error");
	);
	
	set_stage(MAIN_MENU.instantiate());
	#print("Connecting!");
	# DO NOT USE LOCALHOST, use 127.0.0.1 instead
