extends FleetingStage

@onready var container = $Container;



func _ready():
	
	const VOTING_CHOICE:= preload("res://Scenes/Instances/voting_choice.tscn");
	
	for id: int in Client.current_round.drawings:
		var drawing = Client.current_round.drawings[id];
		var name = Client.get_player(id).name;
		var choice = VOTING_CHOICE.instantiate();
		choice.initialize(drawing, name);
		container.add_child(choice);



