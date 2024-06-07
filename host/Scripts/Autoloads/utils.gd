extends Node


func err(condition: bool, message: String) -> bool:
	if condition:
		printerr(message);
	return condition;


