extends FleetingStage

#func _ready():
	#Client.incoming.connect(
		#func(type: String, data):
			#match type:
				#"lobbyCreated":
					#Client.set_join_code(data["joinCode"]);
				#_:
					#pass;
	#);
