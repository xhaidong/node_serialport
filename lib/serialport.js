'use strict';

const serialport = require('serialport');
const fs = require('fs');
const path = require('path');
const net = require('net');
const utils = require('./utils');
const cache = require('./cache');

const GGADELIMITER = Buffer.from('\r\n');
const NtripAgent = 'NTRIP ACEINNA SerialPort/1.0';

class SerialPort {
  constructor(options) {
    this.name = options.name;
    this.baudRate = options.baudRate;
    this.gga = options.gga;
    this.rtcm = options.rtcm;
    this.cmd = options.cmd;
    this.host = options.host;
    this.port = options.port;
    this.mountpoint = options.mountpoint;
    this.password = options.password;
    this.ntripEnable = options.ntripEnable;

    // closed status
    this.closed = false;
    this.binFile = '';

    // serialport connection
    this.spConn = null;
    this.spReady = false;
    this.spBuf = Buffer.alloc(0);
    // ntripcaster connection
    this.ntripConn = null;
    this.ntripReady = false;
  }

  run() {
    console.log(this.name, 'run');

    this.generateFile();
    this.connectSerialport();
    this.connectNtripcaster();
  }

  close() {
    console.log(this.name, 'close');
    this.closed = true;

    // close serialport
    if (this.spConn) {
      this.spConn.removeAllListeners();
      this.spConn.close();
    }

    // close ntripcaster
    if (this.ntripConn) {
      this.spConn.removeAllListeners();
      this.ntripConn.destroy();
    }
  }

  isEqual(options) {
    if (this.name === options.name) {
      return true;
    }
    return false;
  }

  async updateCfg(options) {
    console.log(this.name, 'update config');
    this.gga = options.gga;
    this.rtcm = options.rtcm;
    // reconnect serialport
    if (this.baudRate !== options.baudRate || this.cmd !== options.cmd) {
      this.baudRate = options.baudRate;
      this.cmd = options.cmd;

      await this.reconnectSerialport();
    }

    if (this.host !== options.host ||
      this.port !== options.port ||
      this.mountpoint !== options.mountpoint ||
      this.password !== options.password ||
      this.ntripEnable !== options.ntripEnable) {
      this.host = options.host;
      this.port = options.port;
      this.mountpoint = options.mountpoint;
      this.password = options.password;
      this.ntripEnable = options.ntripEnable;

      await this.reconnectNtripcaster();
    }
  }

  sendRTCM(rtcm) {
    if (!this.rtcm) {
      return;
    }

    this.writeToSp(rtcm);
  }

  async reconnectSerialport() {
    this.generateFile();
    if (this.spConn) {
      this.spConn.close();
    } else {
      this.connectSerialport();
    }
  }

  connectSerialport() {
    if (this.closed) {
      return;
    }

    console.log(this.name, 'connect');
    this.spConn = new serialport(this.name, {
      baudRate: this.baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: false,
    });

    this.spConn.on('open', async () => {
      console.log(this.name, 'on open');

      if (this.cmd.length > 0) {
        const cmdArr = this.cmd.split('\n');
        for (const i in cmdArr) {
          if (k > 0 && k % 10 === 0) {
            await sleep(100);
          }
          const cmd = cmdArr[i];
          this.spConn.write(cmd);
        }
      }

      this.spReady = true;
    });

    this.spConn.on('data', data => {
      this.writeToFile(data);
      this.writeToNtrip(data);
      if (!this.gga) {
        return;
      }

      this.spBuf = Buffer.concat([ this.spBuf, data ]);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const dIdx = this.spBuf.indexOf(GGADELIMITER);
        if (dIdx < 0) {
          if (this.spBuf.length >= 10240) {
            this.spBuf = Buffer.alloc(0);
          }
          return;
        }
        const gga = this.spBuf.slice(0, dIdx + GGADELIMITER.length);
        const dollarIdx = gga.lastIndexOf('$G');
        const ggaIdx = gga.indexOf('GGA');
        // send gga to ntripcaster
        if (dollarIdx >= 0 && ggaIdx > 0) {
          cache.sendGGAToNtrip(gga.slice(dollarIdx));
        }

        this.spBuf = this.spBuf.slice(dIdx + GGADELIMITER.length);
      }
    });

    const doneOnce = utils.doOnce(async () => {
      this.spReady = false;
      this.spConn = null;
      await utils.sleep(1000);
      this.connectSerialport();
    });

    this.spConn.on('close', () => {
      console.log(this.name, 'on close');
      doneOnce();
    });

    this.spConn.on('error', (err) => {
      console.log(this.name, 'on error', err);
      doneOnce();
    });
  }

  reconnectNtripcaster() {
    if (this.ntripConn) {
      this.ntripConn.destroy();
    } else {
      this.connectNtripcaster();
    }
  }

  connectNtripcaster() {
    if (!this.ntripEnable) {
      return;
    }

    if (this.closed) {
      return;
    }

    console.log(this.name, 'connect ntripcaster', this.host, this.port);
    this.ntripConn = net.createConnection({
      host: this.host,
      port: this.port,
    });

    this.ntripConn.on('connect', () => {
      const data = `SOURCE ${this.password} /${this.mountpoint}\r\nSource-Agent: ${NtripAgent}\r\n\r\n`;
      this.ntripConn.write(data);
    });

    this.ntripConn.on('data', data => {
      if (this.ntripReady) {
        return;
      }

      if (data.toString().includes('ICY 200 OK')) {
        this.ntripReady = true;
      }
    });

    const doneOnce = utils.doOnce(async () => {
      this.ntripReady = false;
      this.ntripConn = null;
      await utils.sleep(1000);
      this.connectNtripcaster();
    });

    this.ntripConn.on('close', () => {
      console.log(this.name, 'ntripcaster close', this.host, this.port);
      doneOnce();
    });

    this.ntripConn.on('error', err => {
      console.log(this.name, 'ntripcaster error', this.host, this.port, err);
      doneOnce();
    });
  }

  writeToSp(data) {
    if (this.spReady) {
      this.spConn.write(data);
    }
  }

  writeToNtrip(data) {
    if (!this.ntripReady) {
      return;
    }

    this.ntripConn.write(data);
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
    const basename = path.basename(this.name);
    this.binFile = `${basename}-${dateTime}.bin`;
    this.binFile = path.join(process.app.dataRoot, this.binFile);
  }

  writeToFile(data) {
    fs.writeFile(this.binFile, data, {
      flag: 'a+',
    }, (err) => {
      if (err) {
        console.log('Write file error', err);
      }
    });
  }
}

module.exports = SerialPort;