var http = require("http");
require("http-shutdown").extend();
var redis = require("redis");

var {addr2url, getenv, initLogging} = require("./details");
var createApp = require("./app");

var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS")
};

var log = initLogging();

var redisClient = redis.createClient(config.redis);
redisClient.on("ready", function() {
  log.info("Connected to redis", {url: config.redis});
});

var app = createApp(log, redisClient);

// Create embedded HTTP server
var server = http.createServer(app).withShutdown();
server.listen(config.port, function() {
  var addr = server.address();
  var url = addr2url(addr);
  log.info({url: url, port: addr.port}, "Listening");
});

var SHUTDOWN_WAIT = 5000;
process.on("SIGINT", function() {
  log.warn("Shutting down due to SIGINT");

  redisClient.unref();
  server.shutdown(function() {
    log.info("http server closed");
  });

  setTimeout(function() {
    log.warn("Did not shutdown cleanly after %dms", SHUTDOWN_WAIT);
    process.exit(1);
  }, SHUTDOWN_WAIT).unref();
});
