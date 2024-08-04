class_name LobbyInfo
extends VBoxContainer

@onready var join_code_label: Label = $JoinCode;
@onready var player_header: Label = $PlayerHeader;
@onready var player_container: VBoxContainer = $PlayerContainer;

var player_labels:= {};

func update_player_count():
	player_header.set_text("Players (%s/%s)" % [Client.get_player_count(), "8"]);

func add_player_label(id: int):
	var player: Player = Client.get_player(id);
	var label = Label.new();
	label.set_text(player.name);
	label.set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
	player_container.add_child(label);
	player_labels[id] = label;
func remove_player_label(id: int):
	player_container.remove_child(player_labels[id]);
	player_labels[id].queue_free();
	player_labels.erase(id);
func _ready():
	
	join_code_label.set_text(Client.get_join_code());
	
	update_player_count();
	for id in Client.get_player_ids():
		add_player_label(id);
	
	Client.player_joined.connect(
		func(id: int):
			add_player_label(id);
			update_player_count();
	);
	Client.player_left.connect(
		func(id: int):
			remove_player_label(id);
			update_player_count();
	);

