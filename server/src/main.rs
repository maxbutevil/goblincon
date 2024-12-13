





//use axum::
//use models::*;

//use log::{info, warn, error};



pub mod types;
pub mod goblin_names;
pub mod app;
//mod favicons;

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

use std::env;

use crate::types::*;




#[tokio::main]
async fn main() {
	
	use axum::{
		Router,
		routing::get
	};
	
	tracing_subscriber::fmt::init();
	if dotenvy::dotenv().is_err() {
		tracing::warn!("proceeding without .env file");
	}
	
	
	//use tokio::net::TcpListener;
	//use std::path::PathBuf;
	
	//let dist_path = env::var("").expect();
	//let dist_path = env::var("").expect("")//.unwrap_or_else(|_| "".to_string());
	
	let dist_path = "../client/dist";
	let static_path = format!("{dist_path}/static");
	
	
	let ws_router = Router::new()
		.route("/host", get(ws_upgrade_host))
		.route("/play/join", get(ws_upgrade_player_join))
		.route("/play/rejoin", get(ws_upgrade_player_rejoin));
	let static_service = ServeDir::new(static_path)
		.append_index_html_on_directories(false);
	//let icon_service = 
	//let icon_service = Router::new()
	//	.route("/fa")
	let router = Router::new()
		.nest("/ws", ws_router)
		//.nest("/favicon.ico")
		
		.nest_service("/static", static_service)
		.route("/", get(|| async { Redirect::to("/play") }))
		.route_service("/host", ServeFile::new(format!("{dist_path}/host.html")))
		.route_service("/play", ServeFile::new(format!("{dist_path}/play.html")))
		.route_service("/01.ico", ServeFile::new(format!("{dist_path}/01.ico")))
		
		//.route_service("/testing", ServeFile::new("client/dist/testing.html"))
		.fallback(|| async { "Page Not Found" })
		.with_state(App::new())
		.into_make_service();
	
	let port: &str = option_env!("PORT").unwrap_or("5050");
	let addr = format!("0.0.0.0:{port}").parse().expect("address parsing error");
	
	if let Some(rustls_config) = rustls_config().await {
		tracing::info!("opening with HTTPS");
		axum_server::bind_rustls(addr, rustls_config)
			.serve(router).await
			.expect("axum server error");
	} else {
		tracing::warn!("opening with HTTP");
		axum_server::bind(addr)
			.serve(router)
			.await
			.expect("axum server error");
	}
}
async fn rustls_config() -> Option<RustlsConfig> {
	
	use std::path::PathBuf;
	
	if let Ok(value) = env::var("USE_HTTPS") {
		if value == "NO" {
			return None;
		}
	}
	
	let cert = env::var("CERT_PATH").expect("CERT_PATH must be present if using HTTPS");
	let key = env::var("KEY_PATH").expect("KEY_PATH must be present if using HTTPS");
	let config = RustlsConfig::from_pem_file(
		PathBuf::from(cert),
		PathBuf::from(key)
	).await;
	
	Some(config.expect("TLS certificate configuration error"))
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

/*async fn random_icon() {
	
}*/
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

