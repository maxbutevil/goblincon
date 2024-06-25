class_name Round

var goblin_name: String;
var drawings: Dictionary;
var votes: Dictionary;
var vote_counts: Dictionary;

func _init(goblin_name: String):
	self.goblin_name = goblin_name;

func add_vote(from_id: int, for_id: int) -> void:
	votes[from_id] = for_id;
	vote_counts[for_id] = 1 + vote_counts.get(for_id, 0);
func get_vote(id: int) -> int:
	return votes.get(id, -1);
func get_vote_count(id: int) -> int:
	return vote_counts.get(id, 0);
