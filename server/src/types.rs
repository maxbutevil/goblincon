


pub use tokio::time::Duration;
pub use serde::{Serialize, Deserialize, Deserializer};

//use std::net::SocketAddr;
//use internment::ArcIntern;
//pub type RoomId = [u8; ROOM_ID_LEN];
//pub type ClientId = ArcIntern<SocketAddr>;
pub type PlayerId = u8;
pub type PlayerToken = u32; // can't use usize or javascript will throw a fit
pub type PlayerIcon = u8;

pub use futures_util::{
	SinkExt, StreamExt,
	stream::{SplitSink, SplitStream}
};

pub use rand::prelude::*;
pub use axum::extract::ws::{Message, WebSocket};
pub type WebSocketSender = SplitSink<WebSocket, Message>;
pub type WebSocketReceiver = SplitStream<WebSocket>;

pub const MIN_PLAYER_COUNT: usize = 2;
pub const MAX_PLAYER_COUNT: usize = 12;

pub const MIN_NAME_LEN: usize = 2;
pub const MAX_NAME_LEN: usize = 16;

/*
Timeout if:
 - Nobody submits anything for a round

Timeout player if:
 - 

Also, add kicking
*/

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalPlayerMsgOut<'a> {
	//Terminated,
	Error(&'a str),
	
	InLobby {
		/* player_count sent to the leader so they know if they can start the game */
		#[serde(skip_serializing_if = "Option::is_none")]
		player_count: Option<usize>
	},
	InDrawblins,
	InDating,
}

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalHostMsgOut {
	//Terminated,
	
	InLobby { leader_id: PlayerId },
	//InDrawblins,
	//InDating,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct RoomId([u8; Self::LEN]);
impl RoomId {
	
	const LEN: usize = 5;
	const CHARS: &'static [u8] = b"BCDFGHJKLMNPQRSTVWXZ";
	
	pub fn generate() -> Self {
		let rng = &mut rand::thread_rng();
		let inner = [(); 5].map(|_| *Self::CHARS.choose(rng).unwrap());
		Self(inner)
	}
	pub fn parse(join_code: &str) -> Option<Self> {
		/* Minor note: this method allows invalid characters not usable by generate() */
		/* However, it still guarantees valid UTF-8, so it's fine */
		if join_code.len() != Self::LEN {
			None
		} else {
			join_code
				.as_bytes()
				.first_chunk::<{Self::LEN}>()
				.map(|id| Self(id.to_owned()))
		}
	}
	pub fn as_str<'a>(&'a self) -> &'a str {
		// Safety: A constructed RoomId is guaranteed to contain valid utf8
		unsafe { std::str::from_utf8_unchecked(&self.0) }
	}
}
impl std::ops::Deref for RoomId {
	type Target = [u8; Self::LEN];
	fn deref(&self) -> &[u8; Self::LEN] { &self.0 }
}

//macro_rules! require {
	
//}

/*macro_rules! expect {
	
}

pub trait SoftExpect {
	fn is_unexpected(&self) -> bool;
	
	fn info_expect(&self, what: &str) { if self.is_unexpected() { tracing::info!(what) } }
	fn debug_expect(&self, what: &str) { if self.is_unexpected() { tracing::debug!(what) } }
	fn warn_expect(&self, what: &str) { if self.is_unexpected() { tracing::warn!(what) } }
	fn error_expect(&self, what: &str) { if self.is_unexpected() { tracing::error!(what) } }
}
impl<T> SoftExpect for Option<T> {
	fn is_unexpected(&self) -> bool { self.is_none() }
}
impl<T, E> SoftExpect for Result<T, E> {
	fn is_unexpected(&self) -> bool { self.is_err() }
}*/

/*impl std::ops::DerefMut for RoomId {
	fn deref_mut(&mut self) -> &mut [u8; Self::LEN] { &mut self.0 }
}*/


/*#[derive(Serialize, Deserialize)]
pub struct PlayerId(u8);
impl PlayerId {
	pub fn new(id: u8) {
		if id > MAX_PLAYER_COUNT {
			
		}
		Self(id)
	}
	pub fn usize(&self) -> usize {
		self.0 as usize
	}
}
impl std::ops::Deref for PlayerId {
	type Target = u8;
	fn deref(&self) -> &Self::Target { &self.0 }
}*/

//pub struct PlayerIcon(u8);

