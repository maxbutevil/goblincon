class_name Game
extends Stage

const LANDING:= preload("res://Scenes/Stages/landing.tscn");
const LOBBY:= preload("res://Scenes/Stages/lobby.tscn");
const DRAWING:= preload("res://Scenes/Stages/drawing.tscn");
const VOTING:= preload("res://Scenes/Stages/voting.tscn");
#const SCORING:= preload("res://Scenes/Stages/scoring.tscn");

@onready var player_container: Control = $PlayerContainer;

func create_player_icon(player: Player):
	player.icon = preload("res://Scenes/Instances/player_icon.tscn").instantiate();
	player.icon.set_name(player.name);
	player_container.add_child(player.icon);


func _init():
	super();
	set_open(true);
	set_active(true);

func _ready():
	
	Client.connected.connect(func(): print("Connected!"));
	Client.disconnected.connect(func(): print("Disconnected."));
	Client.player_joined.connect(
		func(player: Player):
			#create_player_icon(player)
			pass;
	);
	#Client.player_left.connect(func(): );
	
	set_root_stage(LANDING.instantiate());
	Client.game_terminated.connect(func(): set_root_stage(LANDING.instantiate()));
	Client.lobby_created.connect(func(): set_root_stage(LOBBY.instantiate()));
	Client.drawing_started.connect(func(): set_root_stage(DRAWING.instantiate()));
	Client.voting_started.connect(func(): set_root_stage(VOTING.instantiate()));
	
	print("Connecting!");
	Client.connect_to_url("ws://127.0.0.1:5050/host/ws");
	# DO NOT USE LOCALHOST, use 127.0.0.1 instead
