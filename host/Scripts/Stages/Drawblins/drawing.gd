extends Control

@onready var name_label: Label = $Container/GoblinName;



# Called when the node enters the scene tree for the first time.
func _ready():
	name_label.set_text(Drawblins.current_round.goblin_name);


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
