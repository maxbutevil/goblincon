extends Node

signal connecting();
signal connected();
signal disconnected();

signal lobby_created(join_code: String);
signal game_started();
signal game_terminated();

signal player_joined(id: int, player: Player);
#signal player_left(id: int);

signal drawing_started(goblin_name: String);
signal voting_started();
signal scoring_started();

signal drawing_received(player_id: int);
signal vote_received(player_id: int, for_id: int);


enum Connection {
	PENDING,
	OPEN,
	CLOSED
}

var ws:= WebSocketPeer.new();
var state:= Connection.CLOSED;

var join_code: String;
var players: Dictionary; # int -> Player
var rounds: Array[Round];
var current_round: Round :
	get: return rounds.back();

func has_player(id: int) -> bool:
	return players.has(id);
func get_player(id: int) -> Player:
	return players[id];

func set_state(new_state: Connection):
	if state != new_state:
		var old_state = state;
		state = new_state;
		
		if old_state == Connection.OPEN:
			disconnected.emit();
			game_terminated.emit();
		elif new_state == Connection.OPEN:
			connected.emit();


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
	
	#print(raw);
	
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
		"lobbyCreated":
			join_code = data["joinCode"];
			lobby_created.emit();
		"gameStarted":
			game_started.emit();
		"gameTerminated":
			game_terminated.emit();
		
		"playerJoined":
			var id: int = data["playerId"];
			players[id] = Player.new(data["playerName"]);
			player_joined.emit(id, players[id]);
		#"playerLeft":
			#handle_player_left(data["playerId"]);
		
		"drawingStarted":
			rounds.push_back(Round.new(data["goblinName"]));
			drawing_started.emit();
		"votingStarted":
			voting_started.emit();
		"scoringStarted":
			scoring_started.emit();
		"drawingSubmitted":
			var id: int = data["playerId"];
			var image = Image.new();
			image.load_png_from_buffer(Marshalls.base64_to_raw(data["drawing"]));
			var drawing: ImageTexture = ImageTexture.create_from_image(image);
			current_round.drawings[id] = drawing;
			drawing_received.emit(id);
		"voteSubmitted":
			var id: int = data["playerId"];
			current_round.votes[id] = data["forId"];
			vote_received.emit(id, data["forId"]);
		_:
			print("Unhandled message: ", raw);

func send(message_type: String, data):
	ws.send_text(JSON.stringify({
		type = message_type,
		data = data
	}));

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




