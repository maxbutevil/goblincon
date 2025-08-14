
// This file is for CloseFrames

//use std::borrow::Cow;
use axum::extract::ws::{
	CloseFrame,
	Utf8Bytes
};


pub type Frame = CloseFrame;

/*  */
pub const LOBBY_FULL: Frame = ok("Lobby is full");
pub const NAME_TAKEN: Frame = ok("Name is taken");
//pub const ALREADY_CONNECTED: Frame = ok("Already connected on this device");

//pub const ROOM_CLOSED: Frame = ok("Room closed");
//pub const CONNECTED_ELSEWHERE: Frame = ok("Connected elsewhere on this device");


/* fatal errors */
// 4000 is for custom errors
//pub const SERVER_ERROR: Frame = err("Server error");
//pub const HOST_DISCONNECTED: Frame = err("Host disconnected");

/* special errors */
pub const INVALID_JOIN: Frame = custom(4001, "Join failed");
pub const INVALID_AUTO_REJOIN: Frame = custom(4002, "Rejoin failed");
pub const INVALID_MANUAL_REJOIN: Frame = custom(4003, "Rejoin failed");
pub const ROOM_CLOSED: Frame = custom(4004, "Room closed");
pub const PLAYER_LEFT: Frame = custom(4005, "Left the game");
pub const PLAYER_KICKED: Frame = custom(4006, "Kicked by host");
pub const ALREADY_CONNECTED: Frame = custom(4007, "Already connected on this device");
pub const CONNECTED_ELSEWHERE: Frame = custom(4008, "Connected elsewhere on this device");

pub const INVALID_HOST_RECONNECT: Frame = custom(4099, "Reconnect failed");

pub const NAME_TOO_SHORT: Frame = err("Name Too Short");
pub const NAME_TOO_LONG: Frame = err("Name Too Long");

//pub const ALREADY_CONNECTED: Frame = custom(4003, "Already connected on this device");


//pub const CONNECTED_ELSEWHERE: Frame = custom(400)
//pub const PLAYER_KICKED: Frame = custom(4004, "Kicked by host");

const fn custom(code: u16, reason: &'static str) -> Frame {
	CloseFrame {
		code,
		reason: Utf8Bytes::from_static(reason)
	}
}
pub const fn ok(reason: &'static str) -> Frame {
	custom(1000, reason)
}
pub const fn err(reason: &'static str) -> Frame {
	custom(4000, reason)
}




