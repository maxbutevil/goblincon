extends FleetingStage

@onready var container = $Container;

var choices: Dictionary = {};

func get_choices() -> Array[VotingChoice]:
	return choices.values();

func _ready():
	
	Client.scoring_started.connect(
		func():
			for id in Client.get_player_ids():
				var choice = choices[id] as VotingChoice;
				choice.set_vote_count(Client.current_round.get_vote_count(id));
	);
	
	const VOTING_CHOICE:= preload("res://Scenes/Instances/voting_choice.tscn");
	
	for id: int in Client.current_round.drawings:
		var drawing = Client.current_round.drawings[id];
		var name = Client.get_player(id).name;
		var choice = VOTING_CHOICE.instantiate();
		choice.initialize(drawing, name);
		container.add_child(choice);
		choices[id] = choice;



