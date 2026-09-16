pub mod structs;

#[cfg(test)]
mod tests;

use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::json;
use serde_json::Value;
use sessionless::hex::IntoHex;
use sessionless::{Sessionless, Signature};
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::option::Option;
use crate::structs::{BDOUser, SuccessResult, EmojicodeResponse};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Spellbook {
    pub spellbookName: String,
    #[serde(flatten)]
    spells: serde_json::Value
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Bases {
    pub bases: serde_json::Value
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Spellbooks {
    pub spellbooks: Vec<Spellbook>
}

pub struct BDO {
    base_url: String,
    client: Client,
    pub sessionless: Sessionless,
}

impl BDO {
    pub fn new(base_url: Option<String>, sessionless: Option<Sessionless>) -> Self {
        println!("🏗️ BDO::new() called with base_url: {:?}", base_url);
        let final_base_url = base_url.unwrap_or("https://dev.bdo.allyabase.com/".to_string());
        println!("🏗️ BDO using final base_url: {}", final_base_url);
        BDO {
            base_url: final_base_url,
            client: Client::new(),
            sessionless: sessionless.unwrap_or(Sessionless::new()),
        }
    }

    async fn get(&self, url: &str) -> Result<Response, reqwest::Error> {
        self.client.get(url).send().await
    }

    async fn post(&self, url: &str, payload: serde_json::Value) -> Result<Response, reqwest::Error> {
        self.client
            .post(url)
            .json(&payload)
            .send()
            .await
    }

    async fn put(&self, url: &str, payload: serde_json::Value) -> Result<Response, reqwest::Error> {
        self.client
            .put(url)
            .json(&payload)
            .send()
            .await
    }

    async fn delete(&self, url: &str, payload: serde_json::Value) -> Result<Response, reqwest::Error> {
        self.client
            .delete(url)
            .json(&payload)
            .send()
            .await
    }

    fn get_timestamp() -> String {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis()
            .to_string()
    }

    pub async fn create_user(&self, hash: &str, bdo: &Value, is_public: &bool) -> Result<BDOUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let pub_key = self.sessionless.public_key().to_hex();
        let signature = self.sessionless.sign(&format!("{}{}{}", timestamp, pub_key, hash)).to_hex();
        
        let payload = json!({
            "timestamp": timestamp,
            "pubKey": pub_key,
            "hash": hash,
            "bdo": bdo,
            "public": is_public,
            "signature": signature
        }).as_object().unwrap().clone();

dbg!("{}", payload.clone());

        println!("🔧 BDO client base_url: {}", self.base_url);
        let url = format!("{}user/create", self.base_url);
        println!("🔗 BDO final URL: {}", &url);
dbg!("{}", &url);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;
dbg!("{}", &res);
        let user: BDOUser = res.json().await?;

        Ok(user)
    }

    pub async fn update_bdo(&self, uuid: &str, hash: &str, bdo: &Value, is_public: &bool) -> Result<BDOUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "uuid": uuid,
            "hash": hash,
            "pub": is_public,
            "pubKey": self.sessionless.public_key().to_hex(),
            "bdo": bdo,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/bdo", self.base_url, uuid);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;
        let user: BDOUser = res.json().await?;

        Ok(user)
    }

    pub async fn get_bdo(&self, uuid: &str, hash: &str) -> Result<BDOUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let url = format!("{}user/{}/bdo?timestamp={}&hash={}&signature={}", self.base_url, uuid, timestamp, hash, signature);
        let res = self.get(&url).await?;
        let user: BDOUser = res.json().await?;
 
        Ok(user)
    }

    pub async fn get_public_bdo(&self, uuid: &str, hash: &str, pub_key: &str) -> Result<BDOUser, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let url = format!("{}user/{}/bdo?timestamp={}&hash={}&signature={}&pubKey={}", self.base_url, uuid, timestamp, hash, signature, pub_key);
dbg!("{}", &url);
dbg!("{}", &self.sessionless.public_key().to_hex());
        let res = self.get(&url).await?;
        let user: BDOUser = res.json().await?;
 
        Ok(user)
    }

    pub async fn get_bases(&self, uuid: &str, hash: &str) -> Result<Value, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let url = format!("{}user/{}/bases?timestamp={}&hash={}&signature={}", self.base_url, uuid, timestamp, hash, signature);
        let res = self.get(&url).await?;
        let bases: Bases = res.json().await?;
 
        Ok(bases.bases)
    }

    pub async fn save_bases(&self, uuid: &str, hash: &str, bases: &Bases) -> Result<Value, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "uuid": uuid,
            "hash": hash,
            "bases": bases,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/bases", self.base_url, uuid);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;
        let bases: Bases = res.json().await?;

        Ok(bases.bases)
    }



    pub async fn get_spellbooks(&self, uuid: &str, hash: &str) -> Result<Vec<Spellbook>, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let url = format!("{}user/{}/spellbooks?timestamp={}&hash={}&signature={}", self.base_url, uuid, timestamp, hash, signature);
        let res = self.get(&url).await?;
        let spellbooks: Spellbooks = res.json().await?;
 
        Ok(spellbooks.spellbooks)
    }

    pub async fn put_spellbook(&self, uuid: &str, hash: &str, spellbook: &Spellbook) -> Result<Vec<Spellbook>, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(message).to_hex();

        let payload = json!({
            "timestamp": timestamp,
            "uuid": uuid,
            "hash": hash,
            "spellbook": spellbook,
            "signature": signature
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/spellbooks", self.base_url, uuid);
        let res = self.put(&url, serde_json::Value::Object(payload)).await?;
        let spellbooks: Vec<Spellbook> = res.json().await?;

        Ok(spellbooks)
    }

    /// Deletes a BDO and everything derived from it.
    ///
    /// pubKey is sent so the server can also remove the *public* record
    /// (`bdo:<pubKey>`) and the emojicode/shortcode mappings. Without it the
    /// server can only reach the hash-keyed copy, and a public BDO stays
    /// readable through the public path — which is the one share links use.
    /// The server verifies this pubKey against the signature rather than
    /// trusting it, so sending it grants no extra authority.
    pub async fn delete_user(&self, uuid: &str, hash: &str) -> Result<SuccessResult, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        // timestamp + uuid + hash, matching update_bdo/get_bdo and, crucially,
        // what continuebee's GET /user/:uuid verifies. This previously signed
        // timestamp + uuid only, so the auth check rejected it every time —
        // delete_user could not have worked even with a correct route.
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(&message).to_hex();

        let payload = json!({
          "timestamp": timestamp,
          "uuid": uuid,
          "hash": hash,
          "signature": signature,
          "pubKey": self.sessionless.public_key().to_hex()
        }).as_object().unwrap().clone();

        let url = format!("{}user/{}/delete", self.base_url, uuid);
        let res = self.delete(&url, serde_json::Value::Object(payload)).await?;
        let success: SuccessResult = res.json().await?;

        Ok(success)
    }


    pub async fn teleport(&self, uuid: &str, hash: &str, url: &str) -> Result<Value, Box<dyn std::error::Error>> {
        let timestamp = Self::get_timestamp();
        let message = format!("{}{}{}", timestamp, uuid, hash);
        let signature = self.sessionless.sign(&message).to_hex();

        // Don't translate here - let the BDO server handle allyabase:// protocol
        let teleport_url = format!(
            "{}user/{}/teleport?timestamp={}&hash={}&signature={}&url={}",
            self.base_url,
            uuid,
            timestamp,
            hash,
            signature,
            urlencoding::encode(url)
        );

        dbg!(&teleport_url);
        let res = self.get(&teleport_url).await?;
        let teleported_content: Value = res.json().await?;

        Ok(teleported_content)
    }

    pub async fn get_bdo_by_emojicode(&self, emojicode: &str) -> Result<EmojicodeResponse, Box<dyn std::error::Error>> {
        let encoded_emojicode = urlencoding::encode(emojicode);
        let url = format!("{}emoji/{}", self.base_url, encoded_emojicode);

        let res = self.get(&url).await?;
        let emojicode_response: EmojicodeResponse = res.json().await?;

        Ok(emojicode_response)
    }
}
