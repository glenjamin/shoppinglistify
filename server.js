var http = require("http");
var express = require("express");
var redis = require("redis");
var uuid = require("uuid");

var { tidyhost, getenv } = require("./details");

var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS")
};

var client = redis.createClient(config.redis);

var app = express();

app.use(function(req, res) {
  res.status(404).json({ error: "not-found" });
});

// Create embedded HTTP server
var server = http.createServer(app);
server.listen(config.port, function() {
  var addr = server.address();
  console.log("Listening on http://%s:%d", tidyhost(addr.address), addr.port);
});

