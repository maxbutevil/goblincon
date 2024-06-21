extends Drawing

var caption: String;

func initialize(drawing: ImageTexture, _caption: String):
	set_texture(drawing);
	caption = _caption;

func _ready():
	$Caption.set_text(caption);
