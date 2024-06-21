extends Stage

const LANDING:= preload("res://Scenes/Stages/landing.tscn");
const LOBBY:= preload("res://Scenes/Stages/lobby.tscn");
const DRAWING:= preload("res://Scenes/Stages/drawing.tscn");
const VOTING:= preload("res://Scenes/Stages/voting.tscn");
#const SCORING:= preload("res://Scenes/Stages/scoring.tscn");

func _init():
	super();
	set_open(true);
	set_active(true);

func _ready():
	
	Client.connected.connect(func(): print("Connected!"));
	Client.disconnected.connect(func(): print("Disconnected."));
	
	set_root_stage(LANDING.instantiate());
	Client.game_terminated.connect(func(): set_root_stage(LANDING.instantiate()));
	Client.lobby_created.connect(func(): set_root_stage(LOBBY.instantiate()));
	Client.drawing_started.connect(func(): set_root_stage(DRAWING.instantiate()));
	Client.voting_started.connect(func(): set_root_stage(VOTING.instantiate()));
	
	print("Connecting!");
	Client.connect_to_url("ws://127.0.0.1:5050/host/ws");
	# DO NOT USE LOCALHOST, use 127.0.0.1 instead
