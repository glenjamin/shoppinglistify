var path = require("path");
var uuid = require("uuid");
var bunyanMiddleware = require("bunyan-middleware");
var express = require("express");
var bodyParser = require("body-parser");
var cors = require('cors');

module.exports = function(log, redis) {
  var app = express();

  app.use(bunyanMiddleware({logger: log, requestStart: true}));
  app.use(bodyParser.json());

  app.use(cors());
  app.options('*', cors());

  app.use(function(req, res, next) {
    res.on("finish", function() {
      if (req.list) {
        req.list.mtime = new Date().toISOString();
        redis.set(req.list.id, JSON.stringify(req.list));
      }
    });

    next();
  });

  app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "/client.html"));
  });
  app.get("/client.js", function(req, res) {
    res.sendFile(path.join(__dirname, "/client.js"));
  });

  app.param("listId", function(req, res, next, listId) {
    redis.get(listId, function(err, reply) {
      if (err) {
        return next(err);
      }
      if (!reply) {
        return res.status(404).json({ error: "list-not-found" });
      }
      try {
        req.list = JSON.parse(reply);
      } catch (ex) {
        return next(ex);
      }
      return next();
    });
  });

  app.post("/list", function(req, res) {
    var listId = uuid.v4();
    req.list = {
      id: listId,
      name: String(req.body.name),
      items: {},
      ctime: new Date().toISOString()
    };
    res.json(req.list);
  });

  app.get("/list/:listId", function(req, res) {
    res.json(req.list);
  });

  app.post("/list/:listId/item", function(req, res) {
    var id = uuid.v4();
    var item = {
      name: String(req.body.name),
      completed: false
    };
    req.list.items[id] = item;
    res.json(req.list);
  });

  app.param("itemId", function(req, res, next, itemId) {
    var item = req.list && req.list.items[itemId];
    if (!item) {
      return res.status(404).json({ error: "item-not-found" });
    }
    req.item = item;
    return next();
  });

  app.post("/list/:listId/item/:itemId/toggle", function(req, res) {
    req.item.completed = !req.item.completed;
    res.json(req.list);
  });

  app.use(function(req, res) {
    res.status(404).json({ error: "not-found" });
  });
  app.use(function(err, req, res, next) {
    res.status(500).json({ error: err.message, stack: err.stack.split("\n") });
    req = res = next;
  });

  return app;
};
