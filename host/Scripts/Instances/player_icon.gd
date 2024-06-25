class_name PlayerIcon
extends Node2D

@onready var sprite: Sprite2D = $Sprite;
@onready var name_label: Label = $NameLabel;



func _ready():
	_target_position = position;

const BASE_TRANSLATE_TIME:= 0.2;
const BASE_SHAKE_TIME:= 0.3;
const BASE_SCALE_TIME:= 0.12;
const BASE_MODULATE_TIME:= 0.12;
const BASE_BLINK_TIME:= 0.3;

const COLOR_NEUTRAL:= Color.YELLOW;
const COLOR_NEGATIVE:= Color.RED;
const COLOR_POSITIVE:= Color.FOREST_GREEN;

var target: Node2D = self;

var position_tween: Tween;
var _target_position: Vector2;

var shake_tween: Tween;

var scale_tween: Tween;
var _target_scale:= Vector2.ONE;

var color_tween: Tween;
var _target_color:= Color.WHITE;
var _target_visible:= is_visible();

func _init():
	visibility_changed.connect(func(): _target_visible = is_visible());
func set_player_name(new_name: String):
	name_label.set_text(new_name);

func _kill_tween(old_tween: Tween) -> Tween:
	if old_tween:
		old_tween.kill();
	return null;
func _replace_tween(old_tween: Tween) -> Tween:
	if old_tween:
		old_tween.kill();
	return create_tween();
func _finish_tween(old_tween: Tween) -> Tween:
	if old_tween:
		old_tween.custom_step(1000.0);
		old_tween.kill();
	return create_tween();

func snap_to(new_position: Vector2):
	_target_position = new_position;
	position_tween = _kill_tween(position_tween);
	position = new_position;
func slide_to(new_target: Vector2, duration:= BASE_TRANSLATE_TIME):
	_target_position = new_target;
	position_tween = _replace_tween(position_tween);
	position_tween.tween_property(target, "position", _target_position, duration);


func _interpolate_to_color(color: Color, duration:= BASE_MODULATE_TIME):
	color_tween = _replace_tween(color_tween);
	color_tween.tween_property(target, "modulate", color, duration);
func set_target_color(color:= Color.WHITE, duration:= BASE_MODULATE_TIME):
	_target_color = color;
	if _target_visible:
		_interpolate_to_color(_target_color, duration);
	else:
		modulate = _target_color;
		modulate.a = 0.0;
func _sanitize_highlight_color(color: Color):
	return Color(
		color.r if color.r > 0.01 else 0.01,
		color.g if color.g > 0.01 else 0.01,
		color.b if color.g > 0.01 else 0.01,
	);
func highlight(color: Color, duration:= BASE_MODULATE_TIME):
	set_target_color(_target_color * _sanitize_highlight_color(color), duration);
func unhighlight(color: Color, duration:= BASE_MODULATE_TIME):
	set_target_color(_target_color / _sanitize_highlight_color(color), duration);
func highlight_from(initial_color: Color, target_color: Color, duration:= BASE_MODULATE_TIME):
	var color: Color = _sanitize_highlight_color(target_color) / _sanitize_highlight_color(initial_color);
	set_target_color(_target_color * color, duration);
func blink(color: Color, duration:= BASE_BLINK_TIME):
	const BLINK_RAMP:= 0.3;
	color_tween = _replace_tween(color_tween);
	color_tween.tween_property(target, "modulate", color, duration * BLINK_RAMP);
	color_tween.tween_interval(duration * (1 - BLINK_RAMP * 2));
	color_tween.tween_property(target, "modulate", _target_color, duration * BLINK_RAMP);
func blink_positivity(positivity: int, duration:= BASE_BLINK_TIME):
	if positivity > 0:
		blink(COLOR_POSITIVE, duration);
	elif positivity < 0:
		blink(COLOR_NEGATIVE, duration);
	else:
		blink(COLOR_NEUTRAL, duration);
func fade_out(duration:= BASE_MODULATE_TIME):
	if _target_visible:
		_target_visible = false;
		_interpolate_to_color(Color.TRANSPARENT, duration);
		color_tween.tween_callback(hide);
func fade_in(duration:= BASE_MODULATE_TIME):
	if !_target_visible:
		_target_visible = true;
		show();
		_interpolate_to_color(_target_color, duration);

func shake(direction: Vector2, duration:= BASE_SHAKE_TIME, count:= 3, decay:= 0.7):
	
	var initial_position:= get_position();
	shake_tween = _replace_tween(shake_tween).set_ease(Tween.EASE_IN);
	
	# Unfuck this
	var last_delta:= Vector2.ZERO;
	
	for i in count:
		var delta:= direction * pow(-decay, i);
		shake_tween.tween_property(target, "position", delta - last_delta, duration/count).as_relative();
		last_delta = delta;
	
	shake_tween.tween_property(target, "position", initial_position, duration/count);
func shake_right(intensity:= 5.0, duration:= BASE_SHAKE_TIME):
	shake(Vector2.RIGHT * intensity, duration);
func shake_left(intensity:= 5.0, duration:= BASE_SHAKE_TIME):
	shake(Vector2.LEFT * intensity, duration);
func shake_up(intensity:= 5.0, duration:= BASE_SHAKE_TIME):
	shake(Vector2.UP * intensity, duration);
func shake_down(intensity:= 5.0, duration:= BASE_SHAKE_TIME):
	shake(Vector2.DOWN * intensity, duration);

func set_target_scale(new_scale: Vector2, duration:= BASE_SCALE_TIME):
	_target_scale = new_scale;
	scale_tween = _replace_tween(scale_tween);
	if _target_visible:
		scale_tween.tween_property(target, "scale", _target_scale, duration);
	else:
		scale = _target_scale;
func scale_vector_multiply(factor: Vector2, duration:= BASE_SCALE_TIME):
	set_target_scale(scale * factor, duration);
func scale_vector_divide(factor: Vector2, duration:= BASE_SCALE_TIME):
	set_target_scale(scale / factor, duration);
func scale_multiply(factor: float, duration:= BASE_SCALE_TIME):
	scale_vector_multiply(Vector2(factor, factor), duration);
func scale_divide(factor: float, duration:= BASE_SCALE_TIME):
	scale_vector_divide(Vector2(factor, factor), duration);
func scale_vector_pulse(factor: Vector2, duration:= 0.2):
	const PULSE_RAMP:= 0.4;
	scale_tween = _replace_tween(scale_tween);
	scale_tween.tween_property(target, "scale", _target_scale * factor, duration * PULSE_RAMP);
	scale_tween.tween_interval(duration * (1.0 - PULSE_RAMP * 2));
	scale_tween.tween_property(target, "scale", _target_scale, duration * PULSE_RAMP);
func scale_pulse(factor: float, duration:= 0.2):
	scale_vector_pulse(Vector2(factor, factor), duration);


