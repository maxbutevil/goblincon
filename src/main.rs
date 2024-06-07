





//use axum::
//use models::*;

//use log::{info, warn, error};



pub mod types;
pub mod goblin_names;
pub mod app;

use app::App;

//use std::sync::Arc;
use axum::{
	http::StatusCode,
	response::Response,
	extract::{
		State,
		Query,
		ws::{WebSocket, WebSocketUpgrade},
	},
};
use tower_http::services::ServeDir;
//use axum_macros::debug_handler;
use serde::Deserialize;

use crate::types::RoomId;


#[derive(Deserialize)]
struct JoinQueryFields {
	code: String,
	name: String
}



#[tokio::main]
async fn main() {
	
	env_logger::builder()
		.filter_level(log::LevelFilter::Info)
		//.filter_level(log::LevelFilter::Debug)
		//.format_target(false)
		.format_timestamp(None)
		.init();
	
	use axum::{
		Router,
		routing::get
	};
	
	let router = Router::new()
		.route("/host/ws", get(ws_upgrade_host))
		.route("/play/ws", get(ws_upgrade_player))
		.nest_service("/", ServeDir::new("player/dist"))
		.with_state(App::new());
	
	log::info!("Listening!");
	let listener = tokio::net::TcpListener::bind("0.0.0.0:5050").await.unwrap();
	axum::serve(listener, router).await.expect("Axum server error");
	
}




//#[debug_handler]
async fn ws_upgrade_host(State(app): State<App>, ws: WebSocketUpgrade) -> Response {
	
	async fn accept_host(app: App, ws: WebSocket) {
		app.accept_host(ws).await;
	}
	
	ws.on_upgrade(move |socket| accept_host(app, socket))
	
}



async fn ws_upgrade_player(State(app): State<App>, ws: WebSocketUpgrade, Query(query): Query<JoinQueryFields>) -> Result<Response, StatusCode> {
	
	async fn accept_player(app: App, ws: WebSocket, room_id: RoomId, name: String) {
		app.accept_player(ws, room_id, name).await;
	}
	
	let (code, name) = (query.code, query.name);
	//log::info!("Player connecting: {code} | {name}");
	
	if let Some(room_id) = App::parse_room_id(&code) {
		if app.has_handle(&room_id) {
			return Ok(ws.on_upgrade(move |socket| {
				accept_player(app, socket, room_id, name)
			}));
		}
	}
	
	log::warn!("Room Not Found [{code}]");
	Err(StatusCode::BAD_REQUEST)
	
}

