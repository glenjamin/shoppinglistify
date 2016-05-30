/* eslint-disable no-process-env */
exports.getenv = function(name) {
  if (process.env[name]) {
    return process.env[name];
  }
  throw new Error(`Missing ${name} environment variable`);
};
/* eslint-enable no-process-env */

exports.tidyhost = function(addr) {
  if (addr == "0.0.0.0" || addr == "::") {
    return "localhost";
  }
  return addr;
};
