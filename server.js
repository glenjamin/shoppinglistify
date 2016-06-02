var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var redis = require("redis");
var uuid = require("uuid");
var bunyanMiddleware = require("bunyan-middleware");

var {addr2url, getenv, initLogging} = require("./details");

var config = {
  port: getenv("PORT"),
  redis: getenv("REDIS")
};

var log = initLogging();

var client = redis.createClient(config.redis);
client.on("ready", function() {
  log.info("Connected to redis", {url: config.redis});
});

var db = {};

var app = express();

app.use(bunyanMiddleware({logger: log}));
app.use(bodyParser.json());

app.post("/list", function(req, res) {
  var listId = uuid.v4();
  db[listId] = {
    id: listId,
    name: req.body.name,
    items: {}
  };
  res.redirect("/list/" + listId);
});

app.param(":listId", function(req, res, next, listId) {
  var list = db[listId];
  if (!list) {
    return res.status(404).json({ error: "list-not-found" });
  }
  req.list = list;
  return next();
});

app.get("/list/:listId", function(req, res) {
  res.json(req.list);
});

app.post("/list/:listId/item", function(req, res) {
  var id = uuid.v4();
  var item = {
    id: id,
    name: req.body.name,
    completed: false
  };
  req.list.items[id] = item;
  res.redirect("/list/" + req.list.id);
});

app.use(function(req, res) {
  res.status(404).json({ error: "not-found" });
});
app.use(function(err, req, res, next) {
  res.status(500).json({ error: err.message, stack: err.stack.split("\n") });
  req = res = next;
});

// Create embedded HTTP server
var server = http.createServer(app);
server.listen(config.port, function() {
  var addr = server.address();
  var url = addr2url(addr);
  log.info({url: url, port: addr.port}, "Listening");
});

