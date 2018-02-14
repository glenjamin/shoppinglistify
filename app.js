var path = require("path");
var uuid = require("uuid");
var bunyanMiddleware = require("bunyan-middleware");
var express = require("express");
var sslify = require("express-sslify");
var bodyParser = require("body-parser");
var cors = require("cors");
var h = require("escape-html");

module.exports = function(log, httpsOnly, redis, email) {
  var app = express();

  setupMiddleware(app, log, httpsOnly);

  setupRoutes(app, log, redis, email);

  return app;
};

function setupMiddleware(app, log, httpsOnly) {
  if (httpsOnly) {
    log.info("Allowing secure connections only");
    app.set("trust proxy", true);
    app.use(sslify.HTTPS());
  }

  app.use(bunyanMiddleware({logger: log, requestStart: true}));
  app.use(bodyParser.json());

  app.use(cors());
  app.options('*', cors());
}

function setupRoutes(app, log, redis, email) {

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
        return next();
      } catch (ex) {
        return next(ex);
      }
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

  app.get("/list/:listId/email", function(req, res) {
    res.send(emailPage({
      to: "someone@example.com",
      subject: "Shoppinglistify: " + req.list.name,
      text: formatText(req.list),
      html: formatHtml(req.list)
    }));
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

  app.get("/crash", function() {
    throw new Error("NOOOOOOOOOOOOOOOOOO!!!!!!!");
  });

  app.use(function(req, res) {
    res.status(404).json({ error: "not-found" });
  });
  app.use(function(err, req, res, next) {
    log.warn(err, "Unexpected error");
    res.status(500).json({ error: err.message, stack: err.stack.split("\n") });
    req = res = next;
  });

  return app;
}

function emailPage(params) {
  return `
<html>
<head>
<title>Email Preview!!</title>
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" integrity="sha384-1q8mTJOASx8j1Au+a5WDVnPi2lkFfwwEAa8hDDdjZlpLegxhjVME1fgjWPGmkzs7" crossorigin="anonymous">
</head>
<body>
<div class="container">
<h1>Email Preview</h1>
<h4>To <small>${h(params.to)}</small></h4>
<h4>Subject <small>${h(params.subject)}</small></h4>
<hr />
<h2>Plain Text</h2>
<hr />
<pre>${h(params.text)}</pre>
<hr />
<h2>Html</h2>
<hr />
<div>${(params.html)}</div>
<hr />
</div>
</body>
</html>
  `;
}

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
      var row = h(item.name);
      if (item.completed) row = "<s>" + row + "</s>";
      return "<li>" + row + "</li>";
    }).join("\n") +
    "</ul>"
  );
}

function map(obj, fn) {
  return Object.keys(obj).map(k => fn(obj[k]));
}
