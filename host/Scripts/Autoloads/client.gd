extends Node

signal connecting();
#signal connected();
#signal disconnected();
signal accepted();
signal terminated();

signal lobby_created(join_code: String);
signal game_started();
signal incoming(type: String, data);

signal player_joined(id: int);
signal player_left(id: int);

#
#signal player_joined(id: int);
#signal player_left(id: int);
#
#signal drawing_started(goblin_name: String);
#signal voting_started();
#signal scoring_started();
#
#signal drawing_received(player_id: int);
#signal vote_received(player_id: int, for_id: int);


enum Connection {
	PENDING,
	OPEN,
	CLOSED
}

enum Mode {
	DRAWBLINS
}

var ws:= WebSocketPeer.new();
var state:= Connection.CLOSED;

var join_code: String;
var players: Dictionary; # int -> Player
var current_game;
#var rounds: Array[Round];
#var current_round: Round :
	#get: return rounds.back();

func get_join_code() -> String:
	return join_code;
func set_join_code(new_code: String):
	join_code = new_code;
func has_player(id: int) -> bool:
	return players.has(id);
func get_player(id: int) -> Player:
	return players[id];
func get_players() -> Array[Player]:
	var _players: Array[Player] = [];
	_players.assign(players.values());
	return _players;
func get_player_ids() -> Array[int]:
	var ids: Array[int] = [];
	ids.assign(players.keys());
	return ids;
func get_player_count() -> int:
	return players.size();

func set_state(new_state: Connection) -> void:
	if state != new_state:
		var old_state = state;
		state = new_state;
		
		if old_state == Connection.OPEN:
			terminated.emit();
		elif new_state == Connection.OPEN:
			accepted.emit();


func connect_to_url(url: String) -> void:
	ws.connect_to_url(url);



func _process(delta: float):
	
	ws.poll();
	match ws.get_ready_state():
		WebSocketPeer.STATE_CONNECTING: set_state(Connection.PENDING);
		WebSocketPeer.STATE_OPEN: pass; # don't enter open state until we receive "accepted" message
		#WebSocketPeer.STATE_OPEN: set_state(Connection.OPEN);
		_: set_state(Connection.CLOSED);
	
	#if state == Connection.OPEN:
	while ws.get_available_packet_count() > 0:
		var packet:= ws.get_packet();
		#print("Packet: ", packet);
		
		if !ws.was_string_packet():
			print("Non-String packet received.");
		else:
			handle(packet.get_string_from_utf8());
func handle(raw: String):
	var message = JSON.parse_string(raw);
	if !message is Dictionary:
		printerr("Error parsing message JSON: ", raw);
		return;
	
	var type = message.get("type");
	var data = message.get("data");
	
	if !type is String:
		printerr("Invalid message type: ", raw);
		return;
	
	print(type, " / ", data);
	
	match type:
		"accepted":
			set_join_code(data["joinCode"]);
			set_state(Connection.OPEN);
		"terminated":
			ws.close();
			set_state(Connection.CLOSED);
		"lobbyCreated":
			lobby_created.emit();
		"gameStarted":
			game_started.emit();
		"playerJoined":
			var id: int = data["playerId"];
			players[id] = Player.new(data["playerName"]);
			player_joined.emit(id);
		"playerLeft":
			var id: int = data["playerId"];
			players.erase(id);
			player_left.emit(id);
		_:
			incoming.emit(type, data);
func send(message_type: String, data):
	ws.send_text(JSON.stringify({
		type = message_type,
		data = data
	}));

#func handle(raw: String):
	#
	##print(raw);
	#
	#var message = JSON.parse_string(raw);
	#if !message is Dictionary:
		#printerr("Error parsing message JSON: ", raw);
		#return;
	#
	#var type = message.get("type");
	#var data = message.get("data");
	#
	#if !type is String:
		#printerr("Invalid message type: ", raw);
		#return;
	#
	#match type:
		#"lobbyCreated":
			#join_code = data["joinCode"];
			#lobby_created.emit();
		#"gameStarted":
			#game_started.emit();
		#"gameTerminated":
			#game_terminated.emit();
		#
		#"playerJoined":
			#var id: int = data["playerId"];
			#players[id] = Player.new(data["playerName"]);
			#player_joined.emit(id);
		#"playerLeft":
			#var id: int = data["playerId"];
			#player_left.emit(id);
		#
		#"drawing":
			#rounds.push_back(Round.new(data["goblinName"]));
			#drawing_started.emit();
		#"voting":
			#voting_started.emit();
		#"scoring":
			#scoring_started.emit();
		#"drawingSubmitted":
			#var id: int = data["playerId"];
			#var image = Image.new();
			#image.load_png_from_buffer(Marshalls.base64_to_raw(data["drawing"]));
			#image.resize(300, 300);
			#var drawing: ImageTexture = ImageTexture.create_from_image(image);
			#current_round.drawings[id] = drawing;
			#drawing_received.emit(id);
		#"voteSubmitted":
			#var id: int = data["playerId"];
			#var for_id: int = data["forId"];
			#current_round.votes[id] = for_id;
			#current_round.vote_counts[for_id] = 1 + current_round.vote_counts.get(for_id, 0);
			#vote_received.emit(id, for_id);
		#_:
			#print("Unhandled message: ", raw);



#func handle_lobby_created(new_join_code: String):
	#join_code = new_join_code;
	#set_phase(Phase.LOBBY);
#func handle_player_joined(player_id: int, player_name: String):
	#var player: Player = Player.new(player_name);
	#players[player_id] = player;
	#player_joined.emit(player_id, player);
##func handle_player_left(player_id: int):
	##player_left.emit(player_id);
#func handle_game_started():
	#set_phase(Phase.START);
#func handle_game_terminated():
	#set_phase(Phase.NONE);
#func handle_drawing_started(new_goblin_name: String):
	#goblin_name = new_goblin_name;
	#for player in players.values():
		#player.drawing = null;
	#set_phase(Phase.DRAW);
#func handle_voting_started():
	#set_phase(Phase.VOTE);
#func handle_scoring_started():
	#set_phase(Phase.SCORE);
#func handle_drawing_submitted(player_id: int, drawing: String):
	#
	#if Utils.err(!has_player(player_id), "Received drawing for invalid player."):
		#return;
	#
	#var image = Image.new();
	#image.load_png_from_buffer(Marshalls.base64_to_raw(drawing));
	#get_player(player_id).drawing = ImageTexture.create_from_image(image);
	#
	#drawing_received.emit(player_id);
#func handle_vote_submitted(player_id: int, for_id: int):
	#vote_received.emit(player_id, for_id);




