var http = require("http");
var express = require("express");
var redis = require("redis");
var uuid = require("uuid");

var bunyan = require("bunyan");
var log = bunyan.createLogger({ name: "shoppinglistify" });

var {addr2url, getenv} = require("./details");

var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS")
};

var client = redis.createClient(config.redis);
client.on("ready", function() {
  log.info("Connected to redis", {url: config.redis});
});

var app = express();

app.use(function(req, res) {
  res.status(404).json({ error: "not-found" });
});

// Create embedded HTTP server
var server = http.createServer(app);
server.listen(config.port, function() {
  var addr = server.address();
  var url = addr2url(addr);
  log.info({url: url, port: addr.port}, "Listening");
});

