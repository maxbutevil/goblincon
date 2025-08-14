

use std::fmt;
use std::ops::Deref;

use serde::{
  Serialize, Serializer,
  de, Deserialize, Deserializer
};

use rand::prelude::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash, Serialize, Deserialize)]
pub struct RoomToken(Token<{RoomToken::LEN}>);
impl Deref for RoomToken {
  type Target = Token<{Self::LEN}>;
  fn deref(&self) -> &Self::Target { &self.0 }
}
impl RoomToken {
  pub const LEN: usize = 5;
  pub fn generate() -> Self {
    const CHARS: &'static [u8] = b"BCDFGHJKLMNPQRSTVWXZ";
    let rng = &mut rand::rng();
    let content = [(); Self::LEN].map(|_| *CHARS.choose(rng).unwrap());
    Self(Token(content))
  }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash, Serialize, Deserialize)]
pub struct ClientToken(Token<{ClientToken::LEN}>);
impl Deref for ClientToken {
  type Target = Token<{Self::LEN}>;
  fn deref(&self) -> &Self::Target { &self.0 }
}
impl ClientToken {
  pub const LEN: usize = 24;
  pub fn generate() -> ClientToken {
    use rand::distr::Alphanumeric;
    let rng = &mut rand::rng();
    let content = [(); Self::LEN].map(|_| Alphanumeric.sample(rng));
    Self(Token(content))
  }
}


// Tokens are immutable, fixed-length utf-8 strings that are meant to be used as identifiers
// Currently they are used as client rejoin tokens and as room IDs
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub struct Token<const LEN: usize>([u8; LEN]);

impl<const LEN: usize> Token<LEN> {
  // Safety: Tokens are constructed from strs, guaranteeing they contain valid utf8
	pub fn as_str<'a>(&'a self) -> &'a str {
		unsafe { std::str::from_utf8_unchecked(&self.0) }
	}
	pub fn from_str(str: &str) -> Option<Self> {
		if str.len() != LEN {
			None
		} else {
			str
				.as_bytes()
				.first_chunk::<LEN>()
				.map(|id| Self(id.to_owned()))
		}
	}
}

impl<const LEN: usize> Deref for Token<LEN> {
	type Target = [u8; LEN];
	fn deref(&self) -> &[u8; LEN] { &self.0 }
}

/* Custom serde impls */
impl<const LEN: usize> Serialize for Token<LEN> {
  fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(self.as_str())
  }
}
impl<'de, const LEN: usize> Deserialize<'de> for Token<LEN> {
	fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
		deserializer.deserialize_str(TokenVisitor)
	}
}

struct TokenVisitor<const LEN: usize>;
impl<'de, const LEN: usize> serde::de::Visitor<'de> for TokenVisitor<LEN> {
	type Value = Token<LEN>;
	fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
    write!(formatter, "a utf-8 string of length {LEN}")
	}
  fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
    let token = Token::<LEN>::from_str(value);
    match token {
      Some(token) => Ok(token),
      None => Err(E::custom(format!("failed to parse token: {value} (should be length {LEN})")))
    }
  }
}

#[test]
fn test_token() {
  let token = RoomToken(Token::from_str(&"ABCDE").unwrap());
  let token_str = "\"ABCDE\"";
  
  assert_eq!(
    token_str,
    serde_json::to_string(&token).unwrap()
  );
  
  assert_eq!(
    serde_json::from_str::<RoomToken>(token_str).unwrap(),
    token
  );
}



