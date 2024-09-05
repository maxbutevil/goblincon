

use serde::{Serialize, Deserialize};
pub use tokio::time::Duration;

//use std::net::SocketAddr;
//use internment::ArcIntern;
//pub type RoomId = [u8; ROOM_ID_LEN];
//pub type ClientId = ArcIntern<SocketAddr>;
pub type PlayerId = u8;
pub type PlayerToken = u32; // can't use usize or javascript will throw a fit

pub enum ClientId {
	Host,
	Player(PlayerId)
}

pub const MIN_PLAYER_COUNT: usize = 2;
pub const MAX_PLAYER_COUNT: usize = 12;
//pub const ROUND_COUNT: usize = 3;
pub const MIN_NAME_LEN: usize = 2;
pub const MAX_NAME_LEN: usize = 16;

//pub const ROOM_ID_LEN: usize = 5;
//pub const ROOM_ID_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
//pub const ROOM_ID_CHARS: &[u8] = b"BCDFGHJKLMNPQRSTVWXZ"; // no vowels

/*#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum StatusKind {
	Ok,
	Err
}*/
#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalPlayerMsgOut<'a> {
	Terminated,
	Error(&'a str),
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalHostMsgOut<'a> {
	Accepted { join_code: &'a str },
	Terminated,
	//Error(&'a str),
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalHostMsgIn {
	Terminate
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct RoomId([u8; Self::LEN]);
impl RoomId {
	
	const LEN: usize = 5;
	const CHARS: &'static [u8] = b"BCDFGHJKLMNPQRSTVWXZ";
	
	pub fn generate() -> Self {
		use rand::Rng;
		let mut rng = rand::thread_rng();
		let inner = [(); 5].map(|_| Self::CHARS[rng.gen_range(0..Self::CHARS.len())]);
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
