class_name Status
extends PanelContainer



const VISIBLE:= Color(1.0, 1.0, 1.0);
const TRANSPARENT:= Color(1.0, 1.0, 1.0, 0.0);

var _tween: Tween;

func show_status(status: String):
	$Label.set_text(status);
	set_modulate(VISIBLE);
	_tween = create_tween();
	_tween.tween_interval(8.0);
	_tween.tween_property(self, "modulate", TRANSPARENT, 2.0);

func _ready():
	set_modulate(TRANSPARENT);


