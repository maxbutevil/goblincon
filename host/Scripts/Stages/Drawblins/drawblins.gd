extends StageMount

const LOBBY:= preload("res://Scenes/Stages/Drawblins/lobby.tscn");
const STARTING:= preload("res://Scenes/Stages/Drawblins/starting.tscn");
const DRAWING:= preload("res://Scenes/Stages/Drawblins/drawing.tscn");
const VOTING:= preload("res://Scenes/Stages/Drawblins/voting.tscn");
const SCORING:= preload("res://Scenes/Stages/Drawblins/scoring.tscn");


# Called when the node enters the scene tree for the first time.
func _ready():
	set_stage(LOBBY.instantiate());
	Client.lobby_created.connect(func(): set_stage(LOBBY.instantiate()));
	#Client.game_started.connect(func(): )
	Client.game_starting.connect(func(): set_stage(STARTING.instantiate()));
	Drawblins.drawing.connect(func(): set_stage(DRAWING.instantiate()));
	Drawblins.voting.connect(func(): set_stage(VOTING.instantiate()));
	Drawblins.scoring.connect(func(): set_stage(SCORING.instantiate()));


