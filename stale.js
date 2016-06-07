/* eslint-disable no-console */
var redis = require("redis");
var redisScanner = require('redis-scanner');
var {getenv} = require("./details");

var argv = require("yargs")
  .usage("Usage: $0 [options]")
  .option("purge", {
    boolean: true,
    describe: "Delete the stale items"
  })
  .option("age", {
    number: true,
    default: 5 * 24 * 3600 * 1000,
    defaultDescription: "5 days",
    describe: "Age in ms to include"
  })
  .help()
  .strict()
  .argv;

var config = {
  redis: getenv("REDIS_URL")
};

var redisClient = redis.createClient(config.redis);
console.log("Connecting to redis on", config.redis);
redisClient.on("ready", function() {
  console.log("Connected to redis");
});

new redisScanner.Scanner(redisClient, "SCAN", null, {
  onData, onEnd
}).start();

var {age, purge} = argv;
var limit = new Date(new Date() - age);
var found = 0;

console.log("Showing items older than " + limit.toISOString());

function onData(listId, done) {
  redisClient.get(listId, (err, rawItem) => {
    if (err) throw err;
    var item = parse(rawItem);
    if (!isNaN(item.mtime) && item.mtime > limit) {
      return done();
    }

    found += 1;
    console.log(`
${item.id}: ${item.name}
mtime: ${item.mtime}
ctime: ${item.ctime}`);

    if (!purge) {
      console.log("Not purging");
      return done();
    }

    return redisClient.del(item.id, (err2) => {
      if (err2) throw err2;
      console.log("Deleted");
      done();
    });
  });
}

function onEnd() {
  console.log();
  if (!purge && found) {
    console.log(`Pass --purge to actually delete ${found} items`);
  }
  if (!found) {
    console.log("No stale items found");
  }
  redisClient.unref();
}

function parse(data) {
  var item = JSON.parse(data);
  item.mtime = new Date(item.mtime);
  item.ctime = new Date(item.ctime);
  return item;
}
