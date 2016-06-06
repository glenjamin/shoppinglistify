var path = require("path");
var uuid = require("uuid");
var bunyanMiddleware = require("bunyan-middleware");
var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var h = require("escape-html");

module.exports = function(log, redis, email) {
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

  app.post("/list/:listId/email", function(req, res, next) {
    var to = req.body.to;
    email.sendMail({
      to: to,
      subject: "Shoppinglistify: " + req.list.name,
      text: formatText(req.list),
      html: formatHtml(req.list)
    }, function(err, info) {
      if (err) return next(err);
      return res.json({
        result: "email-send",
        info: info.response
      });
    });
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

function formatText(list) {
  return (
    "Shoppinglistify: " + list.name + "\n\n" +
    map(list.items, function(item) {
      return "  " + (item.completed ? "☑︎ " : "☐ ") + item.name;
    }).join("\n")
  );
}

function formatHtml(list) {
  return (
    "<h1>Shoppinglistify: " + h(list.name) + "</h1>" +
    "<ul>" +
    map(list.items, function(item) {
      return "<li>" + (item.completed ? "☑︎ " : "☐ ") + h(item.name) + "</li>";
    }).join("\n") +
    "</ul>"
  );
}

function map(obj, fn) {
  return Object.keys(obj).map(k => fn(obj[k]));
}
