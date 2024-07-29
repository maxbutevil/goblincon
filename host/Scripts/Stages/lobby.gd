extends FleetingStage


@onready var join_code_label: Label = $Container/JoinCode;
@onready var name_header_label: Label = $Container/NameHeader;
@onready var name_label_container: VBoxContainer = $Container/NameContainer;

var labels:= {};

func update_player_count():
	name_header_label.set_text("Players (%s/%s)" % [Client.get_player_count(), "8"]);

func add_label(id: int):
	var player: Player = Client.get_player(id);
	var label = Label.new();
	label.set_text(player.name);
	label.set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
	name_label_container.add_child(label);
	labels[id] = label;
func remove_label(id: int):
	name_label_container.remove_child(labels[id]);
	labels[id].queue_free();
	labels.erase(id);
func _ready():
	join_code_label.set_text(Client.get_join_code());
	update_player_count();
	for id in Client.get_player_ids():
		add_label(id);
	
	Client.player_joined.connect(
		func(id: int):
			add_label(id);
			update_player_count();
	);
	Client.player_left.connect(
		func(id: int):
			remove_label(id);
			update_player_count();
	);

