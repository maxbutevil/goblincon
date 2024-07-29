extends FleetingStage

const DRAWING:= preload("res://Scenes/Stages/drawing.tscn");
const VOTING:= preload("res://Scenes/Stages/voting.tscn");
const SCORING:= preload("res://Scenes/Stages/scoring.tscn");


# Called when the node enters the scene tree for the first time.
func _ready():
	print("yipi")
	Drawblins.listen();
	Drawblins.drawing.connect(func(): set_root_stage(DRAWING.instantiate()));
	Drawblins.voting.connect(func(): set_root_stage(VOTING.instantiate()));
	Drawblins.scoring.connect(func(): set_root_stage(SCORING.instantiate()));
func _exit_tree():
	Drawblins.unlisten();



