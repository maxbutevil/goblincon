extends FleetingStage

@onready var container = $Container;

var drawings: Dictionary = {};

func get_drawings() -> Array[Drawing]:
	return drawings.values();

func _ready():
	const DRAWING:= preload("res://Scenes/Instances/drawing.tscn");
	
	var drawing_ids: Array = Drawblins.current_round.drawings.keys();
	if drawing_ids.is_empty():
		var label:= Label.new();
		label.set_text("Nobody submitted...");
		container.add_child(label);
	else:
		drawing_ids.shuffle();
		for id: int in drawing_ids:
			var texture:= Drawblins.current_round.get_drawing(id);
			var name:= Client.get_player(id).name;
			var drawing:= DRAWING.instantiate();
			drawing.initialize(texture, name);
			container.add_child(drawing);
			drawings[id] = drawing;
		Drawblins.results.connect(show_results);
func show_results():
	var vote_counts: Dictionary = Drawblins.current_round.vote_counts.duplicate();
	var vote_order: Array[int] = [];
	for id in vote_counts:
		vote_counts[id] *= 3;
	
	while true:
		var any_left:= false;
		for id: int in drawings.keys():
			if vote_counts.get(id, 0) <= 0:
				continue;
			if vote_counts[id] > 1:
				any_left = true;
			vote_counts[id] -= 1;
			vote_order.push_back(id);
		if !any_left:
			break;
	
	for id: int in vote_order:
		await Utils.timer(0.5);
		if not Utils.err(!drawings.has(id)):
			drawings[id].add_vote();


