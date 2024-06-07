extends Stage

#@onready var landing: Stage = $Landing;
#@onready var lobby: Stage = $Lobby;
#@onready var drawing: Stage = $Drawing;
#@onready var voting: Stage = $Voting;

const LANDING:= preload("res://Scenes/Stages/landing.tscn");
const LOBBY:= preload("res://Scenes/Stages/lobby.tscn");
const DRAWING:= preload("res://Scenes/Stages/drawing.tscn");
const VOTING:= preload("res://Scenes/Stages/voting.tscn");
const SCORING:= preload("res://Scenes/Stages/voting.tscn");

func _init():
	super();
	set_open(true);
	set_active(true);

func _ready():
	
	Client.connected.connect(func(): print("Connected!"));
	Client.disconnected.connect(func(): print("Disconnected."));
	
	set_root_stage(LANDING.instantiate());
	Client.phase_changed.connect(
		func(old: Client.Phase, new: Client.Phase):
			
			match new:
				Client.Phase.NONE: set_root_stage(LANDING.instantiate());
				Client.Phase.LOBBY: set_root_stage(LOBBY.instantiate());
				Client.Phase.DRAW: set_root_stage(DRAWING.instantiate());
				Client.Phase.VOTE: set_root_stage(VOTING.instantiate());
				Client.Phase.SCORE: set_root_stage(SCORING.instantiate());
	);
	
	print("Connecting!");
	# DO NOT USE LOCALHOST, use 127.0.0.1 instead
	Client.connect_to_url("ws://127.0.0.1:5050/host/ws");
