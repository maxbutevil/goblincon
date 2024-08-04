class_name SettingButton
extends Button

var setting: Setting;
var label: String;

func _update_text():
	set_text(self.label % self.setting.get_choice());
func _init(setting: Setting, label: String):
	self.setting = setting;
	self.label = label;
	_update_text();
	
	set_focus_mode(Control.FOCUS_NONE);
	gui_input.connect(
		func(event: InputEvent):
			if event is InputEventMouseButton and event.pressed:
				match event.button_index:
					MOUSE_BUTTON_LEFT: setting.increment();
					MOUSE_BUTTON_RIGHT: setting.decrement();
			_update_text();
	);
