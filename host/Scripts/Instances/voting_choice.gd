class_name Drawing
extends PanelContainer

#@onready var player_name: Label = $Container/PlayerName;
#@onready var vote_pivot: Control = $Container/Votes;

const VOTE_COLORS: Array[Color] = [
	Color.YELLOW,
	Color.GREEN,
	Color.BLUE,
	Color.RED,
	Color.PINK,
	Color.PURPLE
];

const VOTE_OFFSETS: Array[int] = [
	-48,
	-24,
	0,
	24,
	48
];

var caption: String;
var vote_side: bool = ((randi() % 2) == 1);
var left_vote_offsets: Array[int];
var right_vote_offsets: Array[int];

func _vote_offsets() -> Array[int]:
	var offsets:= VOTE_OFFSETS.duplicate();
	offsets.shuffle();
	return offsets;
func _generate_vote_offsets():
	left_vote_offsets = _vote_offsets();
	right_vote_offsets = _vote_offsets();
func _init():
	_generate_vote_offsets();

func initialize(drawing_texture: ImageTexture, player_name: String):
	if !is_inside_tree():
		await tree_entered;
	$Container/Drawing.set_texture(drawing_texture);
	$Container/PlayerName.set_text(player_name);
#func set_vote_count(count: int):
	#$VoteLabel.set_text("%s votes" % count);
func add_vote():
	
	var icon: Control = preload("res://Scenes/Instances/vote_icon.tscn").instantiate();
	#$Container/Votes.add_child(icon);
	
	if vote_side == false:
		$%VotesLeft.add_child(icon);
		if left_vote_offsets.is_empty():
			left_vote_offsets = _vote_offsets();
		icon.position.y = left_vote_offsets.pop_back();
	else:
		$%VotesRight.add_child(icon);
		if right_vote_offsets.is_empty():
			right_vote_offsets = _vote_offsets();
		icon.position.y = right_vote_offsets.pop_back();
	
	vote_side = !vote_side;
