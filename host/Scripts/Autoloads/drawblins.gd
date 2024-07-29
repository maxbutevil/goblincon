extends Node # Drawblins

const DRAWING_WIDTH:= 300.0;
const DRAWING_HEIGHT:= 300.0;

const POINTS_PER_VOTE:= 1;
const POINTS_PER_ROUND_WIN:= 1;

func _ready():
	pass;

signal drawing();
signal voting();
signal results();
signal scoring();

var scores: Dictionary = {};
var rounds: Array[Round] = [];
var current_round: Round :
	get: return rounds.back();

func listen():
	Client.incoming.connect(handle_incoming);
func unlisten():
	Client.incoming.disconnect(handle_incoming);

func get_score(player_id: int) -> int:
	return scores.get(player_id, 0);
func add_score(player_id: int, points: int) -> void:
	scores[player_id] = get_score(player_id) + points;

func handle_incoming(type: String, data):
	match type:
		"drawing":
			rounds.push_back(Round.new(data["goblinName"]));
			drawing.emit();
		"voting":
			voting.emit();
		"results":
			results.emit();
		"scoring":
			for id in Client.get_player_ids():
				add_score(id, current_round.get_vote_count(id));
			scoring.emit();
		"drawingSubmitted":
			current_round.add_drawing(data["playerId"], data["drawing"]);
		"voteSubmitted":
			current_round.add_vote(data["playerId"], data["forId"]);
		_:
			print("Unhandled message (drawblins): ", type, " | ", data);

class Round:
	var goblin_name: String;
	var drawings: Dictionary;
	var votes: Dictionary;
	var vote_counts: Dictionary;
	
	func _init(goblin_name: String):
		self.goblin_name = goblin_name;
	
	func get_drawing(player_id: int) -> ImageTexture:
		return drawings[player_id];
	func get_vote(id: int) -> int:
		return votes.get(id, -1);
	func get_vote_count(for_id: int) -> int:
		return vote_counts.get(for_id, 0);
	func add_drawing(player_id: int, encoded: String):
		var image = Image.new();
		image.load_png_from_buffer(Marshalls.base64_to_raw(encoded));
		image.resize(DRAWING_WIDTH, DRAWING_HEIGHT);
		var drawing: ImageTexture = ImageTexture.create_from_image(image);
		drawings[player_id] = drawing;
	func add_vote(from_id: int, for_id: int) -> void:
		votes[from_id] = for_id;
		vote_counts[for_id] = 1 + vote_counts.get(for_id, 0);
	
