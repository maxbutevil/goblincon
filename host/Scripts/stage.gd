extends Control
class_name Stage

signal opened();
signal closed();
signal open_changed(new_open : bool);

signal activated();
signal deactivated();
signal active_changed(new_active : bool);

signal focused();
signal unfocused();
signal focused_changed(new_focused : bool);


signal open_requested();
signal close_requested(); # Ask the parent stage to close this
signal set_open_requested(new_open : bool);

signal stage_changed(layer: StageLayer, old_stage: Stage, new_stage: Stage);
signal root_stage_changed(old_stage: Stage, new_stage: Stage);

#enum ActiveMode {
	#
	#INACTIVE,
	#ACTIVE,
#}

var _fleeting:= false; # Added as a child when opened, freed when closed

var _open:= false;
var _active:= false;
var _focused:= false; # active and has no active substages

var _layers: Array[StageLayer];
var _root_layer:= create_layer();

func _init():
	#set_visible(_open);
	set_process(false);
	set_visible(false);
	
	_root_layer.stage_changed.connect(
		func(old_stage: Stage, new_stage: Stage):
			root_stage_changed.emit(old_stage, new_stage);
	);
	
	active_changed.connect(
		func(new_active: bool):
			for layer in _layers:
				if layer.has_stage():
					#layer.get_stage().set_active(layer.is_active());
					layer.get_stage().set_active(new_active);
	);
	
	closed.connect(func(): clear_stages()); # for whatever reason, not wrapping this breaks it
func create_layer() -> StageLayer:
	
	var layer:= StageLayer.new();
	add_layer(layer);
	return layer;
func add_layer(layer: StageLayer) -> void:
	_layers.append(layer);
	
	layer.stage_changed.connect(
		func(old_stage: Stage, new_stage: Stage):
			
			if Utils.err(!is_open(), "Changed layer stage while its parent stage is closed."):
				return;
			
			stage_changed.emit(layer, old_stage, new_stage);
			
			if new_stage != null:
				new_stage.set_active(is_active());
			
			#if is_active():
				#
				#if new_stage != null:
					#new_stage.activate();
			
			_update_focused();
			
	);

func set_fleeting(new_fleeting: bool) -> void:
	
	if Utils.err(is_inside_tree(), "Attempted to set_fleeting on stage that is inside tree."):
		return;
	
	_fleeting = new_fleeting;
func is_fleeting() -> bool:
	return _fleeting;

func is_open() -> bool:
	return _open;
func is_active() -> bool:
	return _open and _active;
#func is_substage_active() -> bool:
	#return _substage_active;
func is_focused() -> bool:
	return _focused;

func get_root_layer() -> StageLayer:
	return _root_layer;
func get_layers() -> Array[StageLayer]:
	return _layers;

func get_stage_count() -> int:
	
	var count:= 0;
	
	for layer in _layers:
		if layer.has_stage():
			count += 1;
	
	return count;
func has_stage() -> bool:
	for layer in _layers:
		if layer.has_stage():
			return true;
	
	return false;

func set_open(new_open : bool) -> void:
	
	if new_open != _open:
		_open = new_open;
		
		if !new_open:
			deactivate();
		
		set_process(new_open);
		set_visible(new_open);
		
		(opened if new_open else closed).emit();
		open_changed.emit(new_open);
func set_active(new_active : bool) -> void:
	
	if new_active != _active:
		
		Utils.err(!is_open() and new_active, "Activated a closed subenvironment: %s" % name);
		
		_active = new_active;
		
		(activated if new_active else deactivated).emit();
		active_changed.emit(new_active);
		
		_update_focused();


func _update_focused() -> void:
	
	if !is_active():
		_set_focused(false);
	
	for layer in _layers:
		if layer.has_stage():
			_set_focused(false);
			return;
	
	_set_focused(true);
func _set_focused(new_focused : bool) -> void:
	
	if new_focused != _focused:
		
		_focused = new_focused;
		
		(focused if new_focused else unfocused).emit();
		focused_changed.emit(new_focused);

func add_layers(layers: Array[StageLayer]):
	
	_layers.append_array(layers);
	
	for layer in layers:
	
		layer.stage_changed.connect(
			func(old_stage: Stage, new_stage: Stage):
				pass;
		);

func open():
	set_open(true);
func close():
	set_open(false);
func activate():
	set_active(true);
func deactivate():
	set_active(false);

func open_with_root_stage(stage: Stage, fleeting_parent: Node = self):
	
	if !_open:
		open();
		set_root_stage(stage, fleeting_parent);


func set_stage(layer: StageLayer, stage: Stage, fleeting_parent: Node = self) -> void:
	
	if Utils.err(!layer in _layers, "Error: Attempted to set stage of layer that does not belong to this stage."):
		return;
	
	layer.set_stage(stage, self);
func set_root_stage(stage: Stage, fleeting_parent: Node = self):
	set_stage(_root_layer, stage, fleeting_parent);

func clear_stage(layer: StageLayer) -> void:
	set_stage(layer, null);
func clear_stages() -> void:
	
	for layer in _layers:
		clear_stage(layer);

# Possibly wants an equivalent for activating
func request_set_open(new_open : bool):
	if new_open != _open:
		(open_requested if new_open else close_requested).emit();
		set_open_requested.emit(new_open);
func request_open():
	request_set_open(true);
func request_close():
	request_set_open(false);
func request_toggle_open():
	request_set_open(!_open);

# Substage Methods
#func has_any_substages() -> bool:
#
func get_substages() -> Array[Stage]:
	
	var substages: Array[Stage];
	
	for layer in _layers:
		if layer.has_stage():
			substages.append(layer.get_substage());
	
	return substages;
func get_substage_count() -> int:
	
	var count:= 0;
	
	for layer in _layers:
		if layer.has_stage():
			count += 1;
	
	return count;




class StageLayer:
	
	signal stage_changed(old_stage: Stage, new_stage: Stage);
	#signal active_changed(new_active: bool);
	
	var stage: Stage;
	
	#var open: bool;
	#var active: bool;
	
	func has_stage() -> bool:
		return stage != null;
	func get_stage() -> Stage:
		return stage;
	
	func _close_stage(old_stage: Stage) -> void:
		
		if old_stage == null:
			return;
		
		old_stage.close();
		
		if old_stage.is_fleeting():
			
			var _parent: Node = old_stage.get_parent();
			
			if _parent != null:
				_parent.remove_child(old_stage);
			
			old_stage.queue_free();
	func _open_stage(new_stage: Stage, fleeting_parent: Node = null) -> void:
		
		if new_stage == null:
			return;
		
		if new_stage.is_fleeting() and fleeting_parent != null:
			fleeting_parent.add_child(new_stage);
		
		new_stage.open();
	func set_stage(new_stage: Stage, fleeting_parent: Node = null) -> void:
		
		if stage != new_stage:
			
			var old_stage:= stage;
			stage = new_stage;
			
			_close_stage(old_stage);
			_open_stage(new_stage, fleeting_parent);
			
			stage_changed.emit(old_stage, new_stage);
	func to_stage(new_stage: Stage) -> void:
		set_stage(new_stage);
	func clear_stage() -> void:
		set_stage(null);
	
#	func set_active(new_active: bool) -> void:
#
#		if active != new_active:
#			active = new_active;
#			active_changed.emit(new_active);
#
#			if stage != null:
#				stage.activate();
	

