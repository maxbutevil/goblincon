class_name StageMount
extends Control

signal stage_changed(old: Node, new: Node);

var _stage: Node;

func has_stage() -> bool:
	return _stage != null;
func get_stage() -> Node:
	return _stage;
func set_stage(new_stage: Control) -> void:
	if new_stage == _stage:
		return;
	
	var old_stage:= _stage;
	if old_stage != null:
		remove_child(old_stage);
		old_stage.queue_free();
	
	_stage = new_stage;
	
	if new_stage != null:
		add_child(new_stage);
	
	stage_changed.emit(old_stage, new_stage);
func clear_stage() -> void:
	set_stage(null);

