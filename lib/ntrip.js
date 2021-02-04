'use strict';

const net = require('net');
const path = require('path');
const fs = require('fs');
const utils = require('./utils');
const cache = require('./cache');

const UserAgent = 'NTRIP Aceinna Serialport/1.0';

class Ntripcaster {
  constructor(options) {
    this.host = options.host;
    this.port = options.port;
    this.username = options.username;
    this.password = options.password;
    this.mountpoint = options.mountpoint;
    this.enable = options.enable;
    this.idx = options.idx;

    this.binFile = '';
    this.closed = false;
    this.conn = null;
    this.isReady = false;
  }

  run() {
    console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} run`);

    this.generateFile();
    this.connect();
  }

  isEqual(options) {
    if (this.host === options.host &&
      this.port === options.port &&
      this.username === options.username &&
      this.password === options.password &&
      this.mountpoint === options.mountpoint) {
      return true;
    }
    return false;
  }

  close() {
    console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} close`);
    this.closed = true;

    if (this.conn) {
      this.conn.removeAllListeners();
      this.conn.destroy();
    }
  }

  updateCfg(options) {
    console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} update`);
    if (this.idx !== options.idx) {
      this.generateFile();
    }

    if (this.host !== options.host ||
      this.port !== options.port ||
      this.username !== options.username ||
      this.password !== options.password ||
      this.mountpoint !== options.mountpoint ||
      this.enable !== options.enable) {
      this.host = options.host;
      this.port = options.port;
      this.username = options.username;
      this.password = options.password;
      this.mountpoint = options.mountpoint;
      this.enable = options.enable;
      this.reconnect();
    }
  }

  sendGGA(data) {
    this.write(data);
  }

  write(data) {
    if (this.isReady) {
      this.conn.write(data);
    }
  }

  reconnect() {
    this.generateFile();
    if (this.conn) {
      this.conn.destroy();
    } else {
      this.connect();
    }
  }

  connect() {
    if (this.closed) {
      return;
    }

    if (!this.enable) {
      return;
    }

    console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} connect`);

    this.conn = net.createConnection({
      host: this.host,
      port: this.port
    });

    this.conn.on('connect', () => {
      console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} connected`);
      const authorization = Buffer.from(
        this.username + ':' + this.password,
        'utf8'
      ).toString('base64');
      const data = `GET /${this.mountpoint} HTTP/1.0\r\nUser-Agent: ${UserAgent}\r\nAuthorization: Basic ${authorization}\r\n\r\n`;
      this.conn.write(data);
    });

    this.conn.on('data', data => {
      if (this.isReady) {
        this.writeToFile(data);
        cache.sendRTCMToSp(data);
        return;
      }

      if (data.toString().includes('ICY 200 OK')) {
        this.isReady = true;
      }
    });

    const doneOnce = utils.doOnce(async () => {
      this.isReady = false;
      this.conn = null;
      await utils.sleep(1000);
      this.connect();
    });

    this.conn.on('close', () => {
      console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} close`);
      doneOnce();
    });

    this.conn.on('error', err => {
      console.log(`[Ntripcaster] ${this.host}-${this.mountpoint} error: ${err}`);
      doneOnce();
    });
  }

  generateFile() {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const dateTime = `${year}${month}${day}${hours}${minutes}${seconds}`;
    this.binFile = `station-${this.idx}-${this.mountpoint}-${dateTime}.bin`;
    this.binFile = path.join(process.app.dataRoot, this.binFile);
  }

  writeToFile(data) {
    fs.writeFileSync(this.binFile, data, {
      flag: 'a+',
    });
  }
}

module.exports = Ntripcaster;