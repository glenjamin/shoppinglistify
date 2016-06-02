var http = require("http");
var redis = require("redis");

var {addr2url, getenv, initLogging} = require("./details");
var createApp = require("./app");

var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS")
};

var log = initLogging();

var client = redis.createClient(config.redis);
client.on("ready", function() {
  log.info("Connected to redis", {url: config.redis});
});

var app = createApp(log, client);

// Create embedded HTTP server
var server = http.createServer(app);
server.listen(config.port, function() {
  var addr = server.address();
  var url = addr2url(addr);
  log.info({url: url, port: addr.port}, "Listening");
});

