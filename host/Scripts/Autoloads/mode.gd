class_name Mode
extends Node

func get_settings() -> GameSettings:
	printerr("override Mode.get_settings()");
	return null;
func open() -> void:
	pass;
func close() -> void:
	pass;
func create_stage() -> Node:
	printerr("override Mode.create_stage()");
	return null;

