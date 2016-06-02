var fmt = require("util").format;

var bunyan = require("bunyan");

/* eslint-disable no-process-env */
exports.getenv = function(name) {
  if (process.env[name]) {
    return process.env[name];
  }
  throw new Error(`Missing ${name} environment variable`);
};
/* eslint-enable no-process-env */

exports.addr2url = function(addr) {
  var {address, port} = addr;
  var host = (address == "0.0.0.0" || address == "::") ? "localhost" : address;
  return fmt("http://%s:%d", host, port);
};

exports.initLogging = function() {
  return bunyan.createLogger({
    name: "bl_frontend",
    serializers: {
      req: ({method, originalUrl, ip}) => ({method, ip, url: originalUrl}),
      res: ({statusCode}) => ({statusCode})
    }
  });
};