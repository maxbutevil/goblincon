





//use axum::
//use models::*;

//use log::{info, warn, error};



pub mod types;
pub mod goblin_names;
pub mod app;

use app::App;
//use std::sync::Arc;
//use std::net::SocketAddr;
use axum::{
	http::StatusCode,
	response::{
		Response,
		Redirect
	},
	extract::{
		State,
		Query,
		//ConnectInfo,
		ws::WebSocketUpgrade,
	},
};
use tower_http::services::{ServeFile, ServeDir};
use serde::Deserialize;

use crate::types::*;


//const PORT: &str = "5050";
const IP: &str = "0.0.0.0";

#[tokio::main]
async fn main() {
	
	tracing_subscriber::fmt::init();
	//tracing_subscriber::fmt()
		//.with_level(display_level)
		//.init();
	
	/*env_logger::builder()
		.filter_level(log::LevelFilter::Info)
		//.filter_level(log::LevelFilter::Debug)
		//.format_target(false)
		.format_timestamp(None)
		.init();*/
	
	use tokio::net::TcpListener;
	use axum::{
		Router,
		routing::get
	};
	
	let ws_router = Router::new()
		.route("/host", get(ws_upgrade_host))
		.route("/play/join", get(ws_upgrade_player_join))
		.route("/play/rejoin", get(ws_upgrade_player_rejoin));
	/*let page_router = Router::new()
		// ServeDir handles index.html already (but not the others)
		.route("/", get(|| async { Redirect::to("/play") }))
		.route_service("/host", ServeFile::new("client/dist/host.html"))
		.route_service("/play", ServeFile::new("client/dist/play.html"))
		.fallback(|| async { "Page Not Found" });*/
	let static_service = ServeDir::new("client/dist/assets")
		//.fallback(page_router)
		.append_index_html_on_directories(false);
	let router = Router::new()
		.nest("/ws", ws_router)
		.nest_service("/assets", static_service)
		.route("/", get(|| async { Redirect::to("/play") }))
		.route_service("/host", ServeFile::new("client/dist/host.html"))
		.route_service("/play", ServeFile::new("client/dist/play.html"))
		.fallback(|| async { "Page Not Found" })
		.with_state(App::new());
		//.into_make_service_with_connect_info::<SocketAddr>();
	
	let port = std::env::var("PORT").unwrap_or("5050".to_string());
	let listener = TcpListener::bind(format!("{IP}:{port}"))
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
	ws.on_upgrade(move |socket| async move {
		app.accept_host(socket).await
	})
}

async fn ws_upgrade_player_join(
	State(app): State<App>,
	Query(query): Query<JoinQuery>,
	ws: WebSocketUpgrade
) -> Result<Response, StatusCode>
{
	if let Some(room_id) = app.find_room(&query.code) {
		return Ok(ws.on_upgrade(move |socket| async move {
			app.accept_player_join(socket, room_id, query.name).await
		}));
	}
	
	tracing::debug!("Room Not Found [{}]", query.code);
	Err(StatusCode::BAD_REQUEST)
}
async fn ws_upgrade_player_rejoin(
	State(app): State<App>,
	Query(query): Query<RejoinQuery>,
	ws: WebSocketUpgrade
) -> Result<Response, StatusCode>
{
	if let Some(room_id) = app.find_room(&query.code) {
		return Ok(ws.on_upgrade(move |socket| async move {
			app.accept_player_rejoin(socket, room_id, query.name, query.id, query.token).await
		}));
	}
	
	tracing::debug!("Room Not Found [{}]", query.code);
	Err(StatusCode::BAD_REQUEST)
}

