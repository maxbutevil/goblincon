extends FleetingStage

var entries:= {};

# Called when the node enters the scene tree for the first time.

const SEPARATION:= 36.0;

func _ready():
	
	var ids: Array[int] = Client.get_player_ids();
	ids.sort_custom(
		func(one: int, two: int):
			return Drawblins.get_score(one) < Drawblins.get_score(two);
	);
	
	for i in range(ids.size()):
		var id:= ids[i];
		var entry:= create_entry(Client.get_player(id).name, Drawblins.get_score(id));
		entry.position.y = SEPARATION * (i - ids.size()/2.0);
	
func create_entry(name: String, score: int) -> Node:
	var entry:= Label.new();
	entry.set_text("%s %s" % [name, score]);
	$Container.add_child(entry);
	return entry;
