





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
		//ConnectInfo,
		ws::{WebSocket, WebSocketUpgrade},
	},
};
use tower_http::services::ServeDir;
//use axum_macros::debug_handler;
use serde::Deserialize;

use crate::types::*;


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
		.route("/host", get(ws_upgrade_host))
		.route("/play/join", get(ws_upgrade_player_join))
		.route("/play/rejoin", get(ws_upgrade_player_rejoin))
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
#[serde(rename_all = "camelCase")]
struct JoinQuery {
	code: String,
	name: String
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RejoinQuery {
	code: String,
	name: String,
	id: PlayerId,
	token: PlayerToken
}


//#[debug_handler]
async fn ws_upgrade_host(State(app): State<App>, ws: WebSocketUpgrade) -> Response {
	
	async fn accept_host(app: App, ws: WebSocket) {
		app.accept_host(ws).await;
	}
	
	ws.on_upgrade(move |socket| accept_host(app, socket))
	
}

async fn ws_upgrade_player_join(
	State(app): State<App>,
	Query(query): Query<JoinQuery>,
	ws: WebSocketUpgrade
) -> Result<Response, StatusCode>
{
	async fn accept(app: App, socket: WebSocket, room_id: RoomId, name: String) {
		app.accept_player_join(socket, room_id, name).await;
	}
	
	let (code, name) = (query.code, query.name);
	if let Some(room_id) = App::parse_room_id(&code) {
		if app.has_room(&room_id) {
			return Ok(ws.on_upgrade(move |socket| {
				accept(app, socket, room_id, name)
			}));
		}
	}
	
	log::warn!("Room Not Found [{code}]");
	Err(StatusCode::BAD_REQUEST)
}
async fn ws_upgrade_player_rejoin(
	State(app): State<App>,
	Query(query): Query<RejoinQuery>,
	ws: WebSocketUpgrade
) -> Result<Response, StatusCode>
{
	async fn accept(app: App, socket: WebSocket, room_id: RoomId, name: String, player_id: PlayerId, token: PlayerToken) {
		app.accept_player_rejoin(socket, room_id, name, player_id, token).await;
	}
	
	let (code, name, player_id, token) = (query.code, query.name, query.id, query.token);
	
	if let Some(room_id) = App::parse_room_id(&code) {
		if app.has_room(&room_id) {
			return Ok(ws.on_upgrade(move |socket| {
				accept(app, socket, room_id, name, player_id, token)
			}));
		}
	}
	
	log::warn!("Room Not Found [{code}]");
	Err(StatusCode::BAD_REQUEST)
}

