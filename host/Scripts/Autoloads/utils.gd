extends Node


func timer(time: float):
	await get_tree().create_timer(time).timeout;
func err(condition: bool, message:= "unspecified error") -> bool:
	if condition:
		printerr(message);
		#assert(false, message);
	return condition;


func get_children_in_group(parent: Node, group: String) -> Array[Node]:
	
	var in_group: Array[Node] = [];
	
	for child in parent.get_children():
		if child.is_in_group(group):
			in_group.append(child);
	
	return in_group;


func random_weighted(choices: Array, weights: Array[float]) -> Variant:
	
	var total:= 0.0;
	for weight in weights:
		total += weight;
	
	var r:= randf_range(0, total);
	
	for i in weights.size():
		
		r -= weights[i];
		
		if r <= 0:
			return choices[i];
	
	return null;

func angle_difference(one: float, two: float) -> float:
	
	#var raw:= fmod(one - two + PI, TAU) - PI;
	var delta:= one - two;
	
	#	if abs(delta) > PI:
#		return PI * 2 - delta;
#	else:
#		return delta;
	
	#printt(delta);
	
	if delta < -PI:
		return delta + TAU;
	elif delta > PI:
		return delta - TAU;
	else:
		return delta;

#func _ready():
#	printt(
#		angle_difference(TAU/3, 0),
#		angle_difference(0, TAU/3),
#		angle_difference(-TAU/3, 0),
#		angle_difference(0, -TAU/3), # positive
#		angle_difference(TAU/3, -TAU/3), # negative
#		angle_difference(-TAU/3, TAU/3), # positive
#	);

func smart_lerp_delta(
		from: float, to: float,
		linear: float, constant:= 0.0,
		tolerance:= 0.001, snap_distance:= 0.0,
		step:= 1.0
) -> float:
	
	var dist: float = abs(to - from);
	var tolerance_dist: float = dist - tolerance; # delta to tolerance range
	
	var direction: float = 1.0 if from < to else -1.0; # increase if less, decrease if more
	
	if tolerance_dist <= 0.001: # no movement necessary
		return 0.0; 
	if tolerance_dist <= snap_distance: # snap
		return tolerance_dist * direction;
	
	# min so we don't overshoot
	return direction * min(tolerance_dist, step * (constant + linear * tolerance_dist));
func smart_lerp(
		from: float, to: float,
		linear: float, constant:= 0.0,
		tolerance:= 0.001, snap_distance:= 0.0,
		step:= 1.0
	) -> float:
	return from + smart_lerp_delta(from, to, linear, constant, tolerance, snap_distance, step);
func smart_lerp_angle_delta(
		from: float, to: float,
		linear: float, constant:= 0.0,
		tolerance:= 0.001, snap_distance:= 0.0,
		step:= 1.0
	) -> float:
	
	return smart_lerp_delta(angle_difference(from, to), 0.0, linear, constant, tolerance, snap_distance, step);
func smart_lerp_angle(
		from: float, to: float,
		linear: float, constant:= 0.0,
		tolerance:= 0.001, snap_distance:= 0.0,
		step:= 1.0
	) -> float:
	
	return from + smart_lerp_angle_delta(from, to, linear, constant, tolerance, snap_distance, step);
func smart_lerp_vector_delta(
		from: Vector2, to: Vector2,
		linear: float, constant:= 0.0,
		tolerance:= 0.0, snap_distance:= 0.0,
		step:= 1.0
) -> Vector2:
	# maybe rework to use smart_lerp_delta above
	var difference:= to - from;
	var difference_mag:= difference.length();
	
	if difference_mag <= 0.0001:
		return Vector2.ZERO;
	
	return difference/difference_mag * smart_lerp_delta(0.0, difference_mag, linear, constant, tolerance, snap_distance, step);
	
func smart_lerp_vector(
		from: Vector2, to: Vector2,
		linear: float, constant:= 0.0,
		tolerance:= 0.0, snap_distance:= 0.0,
		step:= 1.0
	) -> Vector2:
	return from + smart_lerp_vector_delta(from, to, linear, constant, tolerance, snap_distance, step);



