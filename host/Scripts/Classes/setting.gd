class_name Setting

signal choice_changed(old: int, new: int);

#var label: String;
var choices: Array;
var choice: int;

func _init(choices: Array, choice:= 0):
	#self.label = label;
	self.choices = choices;
	self.choice = choice;

#func get_label() -> String:
	#return label % get_choice();
func get_choice() -> Variant:
	return choices[choice];
func set_choice(new_choice: int) -> void:
	if new_choice < 0:
		new_choice = choices.size() - 1;
	elif new_choice >= choices.size():
		new_choice = 0;
	if choice != new_choice:
		var old_choice:= choice;
		choice = new_choice;
		choice_changed.emit(old_choice, new_choice);
func increment() -> void:
	set_choice(choice + 1);
func decrement() -> void:
	set_choice(choice - 1);

