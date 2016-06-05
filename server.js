var http = require("http");
require("http-shutdown").extend();
var redis = require("redis");

var {addr2url, getenv, initLogging} = require("./details");
var createApp = require("./app");

var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS_URL")
};

var log = initLogging();

var redisClient = redis.createClient(config.redis);
log.info("Connecting to redis", {url: config.redis});
redisClient.on("ready", function() {
  log.info("Connected to redis");
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
function cleanShutdown() {
  log.warn("Shutting down due to SIGINT");

  redisClient.unref();
  server.shutdown(function() {
    log.info("http server closed");
  });

  setTimeout(function() {
    log.warn("Did not shutdown cleanly after %dms", SHUTDOWN_WAIT);
    process.exit(1);
  }, SHUTDOWN_WAIT).unref();
}
process.on("SIGINT", cleanShutdown);
process.on("SIGTERM", cleanShutdown);
