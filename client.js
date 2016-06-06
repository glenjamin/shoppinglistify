/* eslint-disable no-use-before-define */
/* global React ReactDOM fetch document */
(function() {
  var $ = React.createElement;

  var data = {
    url: "http://localhost:5000",
    email: "glenjamin@gmail.com",
    listId: "<none>",
    itemId: "<none>",
  };

  const merge = (a, b) => Object.assign({}, a, b);

  const update = params => {
    data = merge(data, params);
    render();
  };

  function App({url, email, listId, itemId}) {
    return $("div", {},
      $(Header, {url, email, listId, itemId}),
      $(Example, {
        title: "Create a new list",
        method: "POST",
        path: "/list",
        url: url,
        body: {name: "Shopping"},
        onResponse(resp) { update({listId: resp.id}); }
      }),
      $(Example, {
        title: "Get list details",
        method: "GET",
        path: "/list/:listId",
        url: url,
        params: {listId}
      }),
      $(Example, {
        title: "Add item to list",
        method: "POST",
        path: "/list/:listId/item",
        url: url,
        params: {listId},
        body: {name: "Milk"},
        onResponse(resp) { update({itemId: Object.keys(resp.items).pop() }); }
      }),
      $(Example, {
        title: "Toggle list item",
        method: "POST",
        path: "/list/:listId/item/:itemId/toggle",
        url: url,
        params: {listId, itemId}
      }),
      $(Example, {
        title: "Email list",
        method: "POST",
        path: "/list/:listId/email",
        url: url,
        params: {listId},
        body: {to: email}
      })
    );
  }

  function Header(props) {
    return $("div", {className: "page-header"},
      $("h1", {}, "Shoppinglistify Client"),
      $("div", {className: "row"},
        $(Field, {label: "API URL", name: "url", values: props}),
        $(Field, {name: "email", values: props})
      ),
      $("div", {className: "row"},
        $(Field, {name: "listId", values: props}),
        $(Field, {name: "itemId", values: props})
      )
    );
  }

  function Field({label, name, values}) {
    label = label || name;
    return $("div", {className: "form-group col-xs-6"},
      $("label", {htmlFor: name}, label),
      $("input", {
        id: name, className: "form-control",
        type: name, value: values[name],
        onChange: ({target}) => update({[name]: target.value})
      })
    );
  }

  class Example extends React.Component {
    constructor(props) {
      super(props);
      this.state = {response: null};
    }
    makeRequest() {
      var {url, path, method, params, body} = this.props;
      var fullUrl = Object.keys(params || {}).reduce(
        (str, p) => str.replace(":" + p, encodeURIComponent(params[p])),
        url + path
      );
      var options = {method};
      if (body) {
        options.headers = {"Content-Type": "application/json"};
        options.body = JSON.stringify(body);
      }
      fetch(fullUrl, options)
        .then(r => r.json())
        .then(json => {
          this.setState({response: json});
          if (this.props.onResponse) this.props.onResponse(json);
        })
        .catch(err => this.setState({response: String(err.stack || err)}));
    }
    render() {
      var {title, method, path, params, body} = this.props;
      return $("div", {},
        $("h3", {}, title),
        $("div", {className: "row"},
          $("div", {className: "col-xs-10"},
            $("h4", {className: "mono"}, `${method} ${path}`),
            $("ul", {},
              Object.keys(params || {}).map(p => $("li", { key: p },
                $("code", {}, p), " ", $("span", {}, params[p])
              ))
            ),
            body && $(Json, {json: body})
          ),
          $("div", {className: "col-xs-2 text-center"},
            $("button", {
              className: "btn btn-lg btn-primary btn-block",
              onClick: () => this.makeRequest()
            }, "Go"),
            $("button", {
              className: "btn btn-default btn-block",
              onClick: () => this.setState({response: null})
            }, "Clear")
          )
        ),
        $("h4", {}, "Response"),
        $(Json, {json: this.state.response}),
        $("hr")
      );
    }
  }

  function Json({json}) {
    return $("pre", {className: "mono"}, stringify(json, {maxLength: 50}));
  }

  function render() {
    ReactDOM.render($(App, data), document.getElementById("app"));
  }

  setTimeout(() => render(), 0);
})();


/* eslint-disable */
/* https://raw.githubusercontent.com/lydell/json-stringify-pretty-compact/dff719c8c6e9e2c4e97b666865943f4f442af423/index.js */
// Copyright 2014 Simon Lydell
// X11 (“MIT”) Licensed. (See LICENSE.)
var stringify = (function() {
  function stringify(obj, options) {
    options = options || {}
    var indent = JSON.stringify([1], null, get(options, "indent", 2)).slice(2, -3)
    var maxLength = (indent === "" ? Infinity : get(options, "maxLength", 80))

    return (function _stringify(obj, currentIndent, reserved) {
      if (obj && typeof obj.toJSON === "function") {
        obj = obj.toJSON()
      }

      var string = JSON.stringify(obj)

      if (string === undefined) {
        return string
      }

      var length = maxLength - currentIndent.length - reserved

      if (string.length <= length) {
        var prettified = prettify(string)
        if (prettified.length <= length) {
          return prettified
        }
      }

      if (typeof obj === "object" && obj !== null) {
        var nextIndent = currentIndent + indent
        var items = []
        var delimiters
        var comma = function(array, index) {
          return (index === array.length - 1 ? 0 : 1)
        }

        if (Array.isArray(obj)) {
          for (var index = 0; index < obj.length; index++) {
            items.push(
              _stringify(obj[index], nextIndent, comma(obj, index)) || "null"
            )
          }
          delimiters = "[]"
        } else {
          Object.keys(obj).forEach(function(key, index, array) {
            var keyPart = JSON.stringify(key) + ": "
            var value = _stringify(obj[key], nextIndent,
                                   keyPart.length + comma(array, index))
            if (value !== undefined) {
              items.push(keyPart + value)
            }
          })
          delimiters = "{}"
        }

        if (items.length > 0) {
          return [
            delimiters[0],
            indent + items.join(",\n" + nextIndent),
            delimiters[1]
          ].join("\n" + currentIndent)
        }
      }

      return string
    }(obj, "", 0))
  }

  // Note: This regex matches even invalid JSON strings, but since we’re
  // working on the output of `JSON.stringify` we know that only valid strings
  // are present (unless the user supplied a weird `options.indent` but in
  // that case we don’t care since the output would be invalid anyway).
  var stringOrChar = /("(?:[^"]|\\.)*")|[:,]/g

  function prettify(string) {
    return string.replace(stringOrChar, function(match, string) {
      if (string) {
        return match
      }
      return match + " "
    })
  }

  function get(options, name, defaultValue) {
    return (name in options ? options[name] : defaultValue)
  }

  return stringify;
})();
