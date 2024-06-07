extends Stage

@onready var container: VBoxContainer = $Container;
@onready var join_code_label: Label = $Container/JoinCodeLabel;

var labels = {};

func _init():
	super();
	set_fleeting(true);

func _ready():
	#Client.
	join_code_label.set_text(Client.get_join_code());
	Client.player_joined.connect(
		func(id: int, name: String):
			var label = Label.new();
			label.set_text(name);
			container.add_child(label);
			labels[id] = label;
	);
	Client.player_left.connect(
		func(id: int):
			container.remove_child(labels[id]);
			labels.erase(id);
	);

