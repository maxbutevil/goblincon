
// This file is for CloseFrames

use std::borrow::Cow;
use axum::extract::ws::CloseFrame;

pub type Frame = CloseFrame<'static>;

/*  */
pub const LOBBY_FULL: Frame = ok("Lobby is full");
pub const NAME_TAKEN: Frame = ok("Name is taken");
pub const ALREADY_CONNECTED: Frame = ok("Already connected on this device");

pub const ROOM_CLOSED: Frame = ok("Room closed");
pub const PLAYER_LEFT: Frame = ok("Left the game");
pub const PLAYER_KICKED: Frame = ok("Kicked by host");

/* fatal errors */
// 4000 is for custom errors
//pub const SERVER_ERROR: Frame = err("Server error");
//pub const HOST_DISCONNECTED: Frame = err("Host disconnected");

/* special errors */
pub const INVALID_JOIN: Frame = custom(4001, "Join failed");
pub const INVALID_REJOIN: Frame = custom(4002, "Rejoin failed");
//pub const PLAYER_KICKED: Frame = custom(4004, "Kicked by host");

const fn custom(code: u16, reason: &'static str) -> Frame {
	CloseFrame {
		code,
		reason: Cow::Borrowed(reason)
	}
}
pub const fn ok(reason: &'static str) -> Frame {
	custom(1000, reason)
}
pub const fn err(reason: &'static str) -> Frame {
	custom(4000, reason)
}




