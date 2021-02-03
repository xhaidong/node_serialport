'use strict';

const path = require('path');
const appRoot = path.join(path.dirname(__dirname));
const dataRoot = path.join(appRoot, 'data');

process.app = {
  appRoot,
  dataRoot,
};

const fs = require('fs');
const Http = require('./http');
const config = require('../package.json');

const cache = require('./cache');

const run = () => {
  // check data directory
  if (!fs.existsSync(process.app.dataRoot)) {
    fs.mkdirSync(process.app.dataRoot, {
      recursive: true
    });
  }

  // init serialport
  cache.initSerialport();

  // init ntripcaster
  cache.initNtripcaster();

  // run http server
  const httpServer = new Http();
  httpServer.run();

  console.log(config.name, 'is running, version:', config.version);
};

module.exports = {
  run
};