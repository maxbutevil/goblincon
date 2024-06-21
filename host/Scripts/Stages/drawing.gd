extends Stage


@onready var name_label: Label = $VBoxContainer/NameLabel;


func _init():
	super();
	set_fleeting(true);

# Called when the node enters the scene tree for the first time.
func _ready():
	opened.connect(func(): name_label.set_text(Client.current_round.goblin_name));


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
