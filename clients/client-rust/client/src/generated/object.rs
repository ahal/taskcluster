#![allow(unused_imports)]
#![cfg_attr(rustfmt, rustfmt_skip)]
/* THIS FILE IS AUTOMATICALLY GENERATED. DO NOT EDIT */
use crate::{Client, ClientBuilder, Credentials, Retry};
use anyhow::Error;
use serde_json::Value;
use std::time::Duration;
use crate::util::urlencode;

/// Object Service
///
/// The object service provides HTTP-accessible storage for large blobs of data.
///
/// Objects can be uploaded and downloaded, with the object data flowing directly
/// from the storage "backend" to the caller, and not directly via this service.
/// Once uploaded, objects are immutable until their expiration time.
pub struct Object {
    /// The underlying client used to make API calls for this service.
    pub client: Client
}

#[allow(non_snake_case)]
impl Object {
    /// Create a new Object instance, based on the given client builder
    pub fn new<CB: Into<ClientBuilder>>(client_builder: CB) -> Result<Self, Error> {
        Ok(Self{
            client: client_builder
                .into()
                .path_prefix("api/object/v1/")
                .build()?,
        })
    }

    /// Ping Server
    /// 
    /// Respond without doing anything.
    /// This endpoint is used to check that the service is up.
    pub async fn ping(&self) -> Result<(), Error> {
        let method = "GET";
        let (path, query) = Self::ping_details();
        let body = None;
        let resp = self.client.request(method, path, query, body).await?;
        resp.bytes().await?;
        Ok(())
    }

    /// Generate an unsigned URL for the ping endpoint
    pub fn ping_url(&self) -> Result<String, Error> {
        let (path, query) = Self::ping_details();
        self.client.make_url(path, query)
    }

    /// Generate a signed URL for the ping endpoint
    pub fn ping_signed_url(&self, ttl: Duration) -> Result<String, Error> {
        let (path, query) = Self::ping_details();
        self.client.make_signed_url(path, query, ttl)
    }

    /// Determine the HTTP request details for ping
    fn ping_details<'a>() -> (&'static str, Option<Vec<(&'static str, &'a str)>>) {
        let path = "ping";
        let query = None;

        (path, query)
    }

    /// Begin upload of a new object
    /// 
    /// Create a new object by initiating upload of its data.
    /// 
    /// This endpoint implements negotiation of upload methods.  It can be called
    /// multiple times if necessary, either to propose new upload methods or to
    /// renew credentials for an already-agreed upload.
    /// 
    /// The `name` parameter can contain any printable ASCII character (0x20 - 0x7e).
    /// The `uploadId` must be supplied by the caller, and any attempts to upload
    /// an object with the same name but a different `uploadId` will fail.
    /// Thus the first call to this method establishes the `uploadId` for the
    /// object, and as long as that value is kept secret, no other caller can
    /// upload an object of that name, regardless of scopes.  Object expiration
    /// cannot be changed after the initial call, either.  It is possible to call
    /// this method with no proposed upload methods, which has the effect of "locking
    /// in" the `expiration`, `projectId`, and `uploadId` properties and any
    /// supplied hashes.
    /// 
    /// Unfinished uploads expire after 1 day.
    pub async fn createUpload(&self, name: &str, payload: &Value) -> Result<Value, Error> {
        let method = "PUT";
        let (path, query) = Self::createUpload_details(name);
        let body = Some(payload);
        let resp = self.client.request(method, &path, query, body).await?;
        Ok(resp.json().await?)
    }

    /// Determine the HTTP request details for createUpload
    fn createUpload_details<'a>(name: &'a str) -> (String, Option<Vec<(&'static str, &'a str)>>) {
        let path = format!("upload/{}", urlencode(name));
        let query = None;

        (path, query)
    }

    /// Mark an upload as complete.
    /// 
    /// This endpoint marks an upload as complete.  This indicates that all data has been
    /// transmitted to the backend.  After this call, no further calls to `uploadObject` are
    /// allowed, and downloads of the object may begin.  This method is idempotent, but will
    /// fail if given an incorrect uploadId for an unfinished upload.
    /// 
    /// Note that, once `finishUpload` is complete, the object is considered immutable.
    pub async fn finishUpload(&self, name: &str, payload: &Value) -> Result<(), Error> {
        let method = "POST";
        let (path, query) = Self::finishUpload_details(name);
        let body = Some(payload);
        let resp = self.client.request(method, &path, query, body).await?;
        resp.bytes().await?;
        Ok(())
    }

    /// Determine the HTTP request details for finishUpload
    fn finishUpload_details<'a>(name: &'a str) -> (String, Option<Vec<(&'static str, &'a str)>>) {
        let path = format!("finish-upload/{}", urlencode(name));
        let query = None;

        (path, query)
    }

    /// Download object data
    /// 
    /// Start the process of downloading an object's data.  Call this endpoint with a list of acceptable
    /// download methods, and the server will select a method and return the corresponding payload.
    /// 
    /// Returns a 406 error if none of the given download methods are available.
    /// 
    /// See [Download Methods](https://docs.taskcluster.net/docs/reference/platform/object/download-methods) for more detail.
    pub async fn startDownload(&self, name: &str, payload: &Value) -> Result<Value, Error> {
        let method = "PUT";
        let (path, query) = Self::startDownload_details(name);
        let body = Some(payload);
        let resp = self.client.request(method, &path, query, body).await?;
        Ok(resp.json().await?)
    }

    /// Determine the HTTP request details for startDownload
    fn startDownload_details<'a>(name: &'a str) -> (String, Option<Vec<(&'static str, &'a str)>>) {
        let path = format!("start-download/{}", urlencode(name));
        let query = None;

        (path, query)
    }

    /// Get an object's metadata
    /// 
    /// Get the metadata for the named object.  This metadata is not sufficient to
    /// get the object's content; for that use `startDownload`.
    pub async fn object(&self, name: &str) -> Result<Value, Error> {
        let method = "GET";
        let (path, query) = Self::object_details(name);
        let body = None;
        let resp = self.client.request(method, &path, query, body).await?;
        Ok(resp.json().await?)
    }

    /// Generate an unsigned URL for the object endpoint
    pub fn object_url(&self, name: &str) -> Result<String, Error> {
        let (path, query) = Self::object_details(name);
        self.client.make_url(&path, query)
    }

    /// Generate a signed URL for the object endpoint
    pub fn object_signed_url(&self, name: &str, ttl: Duration) -> Result<String, Error> {
        let (path, query) = Self::object_details(name);
        self.client.make_signed_url(&path, query, ttl)
    }

    /// Determine the HTTP request details for object
    fn object_details<'a>(name: &'a str) -> (String, Option<Vec<(&'static str, &'a str)>>) {
        let path = format!("metadata/{}", urlencode(name));
        let query = None;

        (path, query)
    }

    /// Get an object's data
    /// 
    /// Get the data in an object directly.  This method does not return a JSON body, but
    /// redirects to a location that will serve the object content directly.
    /// 
    /// URLs for this endpoint, perhaps with attached authentication (`?bewit=..`),
    /// are typically used for downloads of objects by simple HTTP clients such as
    /// web browsers, curl, or wget.
    /// 
    /// This method is limited by the common capabilities of HTTP, so it may not be
    /// the most efficient, resilient, or featureful way to retrieve an artifact.
    /// Situations where such functionality is required should ues the
    /// `startDownload` API endpoint.
    /// 
    /// See [Simple Downloads](https://docs.taskcluster.net/docs/reference/platform/object/simple-downloads) for more detail.
    pub async fn download(&self, name: &str) -> Result<(), Error> {
        let method = "GET";
        let (path, query) = Self::download_details(name);
        let body = None;
        let resp = self.client.request(method, &path, query, body).await?;
        resp.bytes().await?;
        Ok(())
    }

    /// Generate an unsigned URL for the download endpoint
    pub fn download_url(&self, name: &str) -> Result<String, Error> {
        let (path, query) = Self::download_details(name);
        self.client.make_url(&path, query)
    }

    /// Generate a signed URL for the download endpoint
    pub fn download_signed_url(&self, name: &str, ttl: Duration) -> Result<String, Error> {
        let (path, query) = Self::download_details(name);
        self.client.make_signed_url(&path, query, ttl)
    }

    /// Determine the HTTP request details for download
    fn download_details<'a>(name: &'a str) -> (String, Option<Vec<(&'static str, &'a str)>>) {
        let path = format!("download/{}", urlencode(name));
        let query = None;

        (path, query)
    }
}
