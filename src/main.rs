





//use axum::
//use models::*;

//use log::{info, warn, error};



pub mod types;
pub mod goblin_names;
pub mod app;

use app::App;
//use std::sync::Arc;
use std::net::SocketAddr;
use axum::{
	http::StatusCode,
	response::Response,
	extract::{
		State,
		Query,
		ConnectInfo,
		ws::{WebSocket, WebSocketUpgrade},
	},
};
use tower_http::services::ServeDir;
//use axum_macros::debug_handler;
use serde::Deserialize;

use crate::types::RoomId;


const PORT: &str = "5050";
const IP: &str = "0.0.0.0";

#[tokio::main]
async fn main() {
	
	env_logger::builder()
		.filter_level(log::LevelFilter::Info)
		//.filter_level(log::LevelFilter::Debug)
		//.format_target(false)
		.format_timestamp(None)
		.init();
	
	use tokio::net::TcpListener;
	use axum::{
		Router,
		routing::get
	};
	
	let router = Router::new()
		.route("/host/ws", get(ws_upgrade_host))
		.route("/play/ws", get(ws_upgrade_player))
		.nest_service("/", ServeDir::new("player/dist"))
		.with_state(App::new())
		.into_make_service_with_connect_info::<SocketAddr>();
	
	let listener = TcpListener::bind(format!("{IP}:{PORT}"))
		.await
		.expect("server error");
	axum::serve(listener, router)
		.await
		.expect("axum error");
	
}

#[derive(Deserialize)]
struct JoinQueryFields {
	code: String,
	name: String
}

//#[debug_handler]
async fn ws_upgrade_host(State(app): State<App>, ws: WebSocketUpgrade) -> Response {
	
	async fn accept_host(app: App, ws: WebSocket) {
		app.accept_host(ws).await;
	}
	
	ws.on_upgrade(move |socket| accept_host(app, socket))
	
}



async fn ws_upgrade_player(
	State(app): State<App>,
	ws: WebSocketUpgrade,
	ConnectInfo(addr): ConnectInfo<SocketAddr>,
	Query(query): Query<JoinQueryFields>
) -> Result<Response, StatusCode>
{
	
	async fn accept_player(app: App, room_id: RoomId, ws: WebSocket, addr: SocketAddr, name: String) {
		app.accept_player(room_id, ws, addr, name).await;
	}
	
	let (code, name) = (query.code, query.name);
	//log::info!("Player connecting: {code} | {name}");
	
	if let Some(room_id) = App::parse_room_id(&code) {
		if app.has_handle(&room_id) {
			return Ok(ws.on_upgrade(move |socket| {
				accept_player(app, room_id, socket, addr, name)
			}));
		}
	}
	
	log::warn!("Room Not Found [{code}]");
	Err(StatusCode::BAD_REQUEST)
	
}

