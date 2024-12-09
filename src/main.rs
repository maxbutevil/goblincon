





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
use axum_server::tls_rustls::RustlsConfig;
use tower_http::services::{ServeFile, ServeDir};
use serde::Deserialize;

use crate::types::*;


#[tokio::main]
async fn main() {
	
	
	
	tracing_subscriber::fmt::init();
	//tracing_subscriber::fmt()
		//.with_level(display_level)
		//.init();
	
	//use tokio::net::TcpListener;
	use std::path::PathBuf;
	use axum::{
		Router,
		routing::get
	};
	
	let ws_router = Router::new()
		.route("/host", get(ws_upgrade_host))
		.route("/play/join", get(ws_upgrade_player_join))
		.route("/play/rejoin", get(ws_upgrade_player_rejoin));
	let static_service = ServeDir::new("client/dist/static")
		.append_index_html_on_directories(false);
	let router = Router::new()
		.nest("/ws", ws_router)
		.nest_service("/static", static_service)
		.route("/", get(|| async { Redirect::to("/play") }))
		.route_service("/host", ServeFile::new("client/dist/host.html"))
		.route_service("/play", ServeFile::new("client/dist/play.html"))
		//.route_service("/testing", ServeFile::new("client/dist/testing.html"))
		.fallback(|| async { "Page Not Found" })
		.with_state(App::new());
	
	
	
	/*let listener = TcpListener::bind(format!("{IP}:{port}"))
		.await
		.expect("tcp listener error");
	axum::serve(listener, router)
		.await
		.expect("axum error");*/
	
	/* SSL */
	let manifest_dir = env!("CARGO_MANIFEST_DIR");
	let tls_dir = option_env!("TLS_DIR").unwrap_or("tls");
	let tls_dir = PathBuf::from(manifest_dir).join(tls_dir);
	let rustls_config = RustlsConfig::from_pem_file(
		tls_dir.join("cert.pem"),
		tls_dir.join("key.pem")
	).await.expect("TLS certificate configuration error");
	
	const IP: &str = "0.0.0.0";
	let port: &str = option_env!("PORT").unwrap_or("5050");
	let addr = format!("{IP}:{port}").parse().unwrap();
	axum_server::bind_rustls(addr, rustls_config)
		.serve(router.into_make_service())
		.await
		.expect("axum server error");
	
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinQuery {
	code: String,
	
	name: String,
	#[serde(default)]
	icon: PlayerIcon
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RejoinQuery {
	code: String,
	id: PlayerId,
	token: PlayerToken,
}

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
			app.accept_player_join(socket, room_id, query.name, query.icon).await
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
			app.accept_player_rejoin(socket, room_id, query.id, query.token).await
		}));
	}
	
	tracing::debug!("Room Not Found [{}]", query.code);
	Err(StatusCode::BAD_REQUEST)
}

