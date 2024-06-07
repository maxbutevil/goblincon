

use serde::{Serialize, Deserialize};

//use std::net::SocketAddr;
//use internment::ArcIntern;
pub type RoomId = [u8; ROOM_ID_LEN];
//pub type ClientId = ArcIntern<SocketAddr>;
pub type PlayerId = u8;

pub use std::time::Duration;

pub const ROUND_COUNT: usize = 3;
pub const NAME_MAX_LEN: usize = 12;
pub const MIN_PLAYER_COUNT: usize = 1;
pub const MAX_PLAYER_COUNT: usize = 8;

pub const START_DURATION: Duration = Duration::from_secs(2);
pub const DRAW_DURATION: Duration = Duration::from_secs(10);
pub const VOTE_DURATION: Duration = Duration::from_secs(10);
pub const SCORE_DURATION: Duration = Duration::from_secs(10);

pub const ROOM_ID_LEN: usize = 5;
pub const ROOM_ID_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";


#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum HostMessageIn {
	//CreateGame {}
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PlayerMessageIn {
	//JoinGame { room_id: RoomId, player_name: String },
	StartGame,
	DrawingSubmission { drawing: String },
	VoteSubmission { for_id: PlayerId }
}


#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum HostMessageOut<'a> {
	
	
	LobbyCreated { join_code: &'a str },
	PlayerJoined { player_id: PlayerId, player_name: String },
	//PlayerLeft { },
	
	GameStarted,
	GameTerminated,
	
	DrawingStarted { goblin_name: &'a str },
	VotingStarted,
	ScoringStarted { vote_counts: [u8; MAX_PLAYER_COUNT] },
	
	DrawingSubmitted { player_id: PlayerId, drawing: &'a str },
	VoteSubmitted { player_id: PlayerId, for_id: PlayerId }
	
}

#[derive(Serialize)]
#[derive(Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PlayerMessageOut<'a> {
	
	//JoinedGame { room_id: RoomId }, //players: Vec<RemotePlayer> }
	//PlayerJoined { player_id: usize, player_name: String },
	
	Promoted,
	
	GameStarted,
	GameTerminated,
	
	DrawingStarted,
	VotingStarted { choices: &'a Vec<String> },
	ScoringStarted,
	
	
	//Placeholder(std::marker::PhantomData<&'a str>)
	
	//DrawingSubmitted { player_id: usize, drawing: &'a str },
	
}







