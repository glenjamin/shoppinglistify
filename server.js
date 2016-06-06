var http = require("http");
require("http-shutdown").extend();
var redis = require("redis");
var nodemailer = require("nodemailer");

var {addr2url, getenv, initLogging} = require("./details");
var createApp = require("./app");

// Read config from environment variables
var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS_URL"),
  smtp: {
    host: getenv("SMTP_HOST"),
    port: Number(getenv("SMTP_PORT")),
    secure: Boolean(getenv("SMTP_SECURE") == "true"),
    auth: getenv("SMTP_USER") ? {
      user: getenv("SMTP_USER"),
      pass: getenv("SMTP_PASS"),
    } : null
  }
};

var log = initLogging();

// Create redis connection
var redisClient = redis.createClient(config.redis);
log.info("Connecting to redis", {url: config.redis});
redisClient.on("ready", function() {
  log.info("Connected to redis");
});

// Create SMTP connection
var emailClient = nodemailer.createTransport(
  Object.assign({logger: log}, config.smtp),
  {from: '"Shoppinglistify" <shoppinglistify@stainlessed.co.uk>'}
);
log.info("Connecting to SMTP", {smtp: config.smtp});
emailClient.verify(function(err, success) {
  if (err) throw err;
  log.info("Connected to SMTP", {success});
});

var app = createApp(log, redisClient, emailClient);

// Create embedded HTTP server
var server = http.createServer(app).withShutdown();
server.listen(config.port, function() {
  var addr = server.address();
  var url = addr2url(addr);
  log.info({url: url, port: addr.port}, "Listening");
});

// Ensure process shuts down cleanly on signals
var SHUTDOWN_WAIT = 5000;
process.on("SIGINT", cleanShutdown);
process.on("SIGTERM", cleanShutdown);

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
