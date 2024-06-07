extends Node


signal connected();
signal disconnected();

signal phase_changed(old: Phase, new: Phase);
signal player_joined(id: int, name: String);
signal player_left(id: int);
signal drawing_received(player_id: int, drawing: String);
signal vote_received(player_id: int, for_id: int);

enum Connection {
	PENDING,
	OPEN,
	CLOSED
}
enum Phase {
	NONE,
	LOBBY,
	START,
	DRAW,
	VOTE,
	SCORE,
}

var ws:= WebSocketPeer.new();
var state:= Connection.CLOSED;
var phase:= Phase.NONE;

var join_code: String;
var goblin_name: String;
var drawings: Dictionary;


func get_join_code() -> String:
	return join_code;
func get_goblin_name() -> String:
	return goblin_name;

#func _ready():
	#ws.connect_to_url("ws://localhost:5050/host/ws");
	#ws.data_received

func set_state(new_state: Connection):
	if state != new_state:
		var old_state = state;
		state = new_state;
		
		if old_state == Connection.OPEN:
			set_phase(Phase.NONE);
			disconnected.emit();
		elif new_state == Connection.OPEN:
			#set_phase(Phase.LOBBY);
			connected.emit();
func set_phase(new_phase: Phase):
	if phase != new_phase:
		var old_phase = phase;
		phase = new_phase;
		phase_changed.emit(old_phase, new_phase);


func connect_to_url(url: String):
	ws.connect_to_url(url);



func _process(delta: float):
	
	ws.poll();
	match ws.get_ready_state():
		WebSocketPeer.STATE_CONNECTING: set_state(Connection.PENDING);
		WebSocketPeer.STATE_OPEN: set_state(Connection.OPEN);
		_: set_state(Connection.CLOSED);
	
	if state == Connection.OPEN:
		while ws.get_available_packet_count() > 0:
			var packet:= ws.get_packet();
			#print("Packet: ", packet);
			
			if !ws.was_string_packet():
				print("Non-String packet received.");
			else:
				handle(packet.get_string_from_utf8());

func handle(raw: String):
	
	print(raw);
	
	var message = JSON.parse_string(raw);
	if !message is Dictionary:
		printerr("Error parsing message JSON: ", raw);
		return;
	
	var type = message.get("type");
	var data = message.get("data");
	
	if !type is String:
		printerr("Invalid message type: ", raw);
		return;
	
	match type:
		"lobbyCreated": handle_lobby_created(data["joinCode"]);
		"playerJoined": handle_player_joined(data["playerId"], data["playerName"]);
		"gameStarted": handle_game_started();
		"gameTerminated": handle_game_terminated();
		#"playerLeft": handle_player_left(data["playerId"]);
		"drawingStarted": handle_drawing_started(data["goblinName"]);
		"votingStarted": handle_voting_started();
		"scoringStarted": handle_scoring_started();
		"drawingSubmitted": handle_drawing_submitted(data["playerId"], data["drawing"]);
		"voteSubmitted": handle_vote_submitted(data["playerId"], data["forId"]);
		_: print("Unhandled message: ", raw);

func handle_lobby_created(new_join_code: String):
	join_code = new_join_code;
	set_phase(Phase.LOBBY);
func handle_player_joined(player_id: int, player_name: String):
	player_joined.emit(player_id, player_name);
#func handle_player_left(player_id: int):
	#player_left.emit(player_id);
func handle_game_started():
	set_phase(Phase.START);
func handle_game_terminated():
	set_phase(Phase.NONE);
func handle_drawing_started(new_goblin_name: String):
	goblin_name = new_goblin_name;
	drawings = {};
	set_phase(Phase.DRAW);
func handle_voting_started():
	set_phase(Phase.VOTE);
func handle_scoring_started():
	set_phase(Phase.SCORE);
func handle_drawing_submitted(player_id: int, drawing: String):
	drawings[player_id] = drawing;
	drawing_received.emit(player_id, drawing);
func handle_vote_submitted(player_id: int, for_id: int):
	vote_received.emit(player_id, for_id);


func send(message_type: String, data):
	ws.send_text(JSON.stringify({
		type = message_type,
		data = data
	}));


