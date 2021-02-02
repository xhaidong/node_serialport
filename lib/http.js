'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const cache = require('./cache');

const config = require('../config/config.json');
const staticRoot = path.join(process.app.appRoot, 'static');

class Http {
  run() {
    const server = http.createServer(this.httpHandler());

    server.on('listening', () => {
      console.log(`http server is startd, please open http://127.0.0.1:${config.port}`);
    });

    server.listen({
      port: config.port
    });
  }

  httpHandler() {
    return (req, res) => {
      if (req.method === 'GET') {
        return this.handleStatic(req, res);
      }

      if (req.method === 'POST') {
        return this.handlePost(req, res);
      }
    }
  }

  handleStatic(req, res) {
    let pathname = req.url;
    if (pathname === '/') {
      pathname = 'index.html'
    }

    pathname = pathname.replace(/\.\./g, '');

    const realpath = path.join(staticRoot, pathname);
    fs.readFile(realpath, (err, data) => {
      if (err) {
        res.writeHead(404, {'Content-Type': 'text/html;charset="utf-8"'});
      } else {
        const extname = path.extname(realpath);
        const mime = this.mime(extname);
        res.writeHead(200, {'Content-Type': `${mime};charset='utf-8'`});
        res.write(data);
      }
      res.end();
    });
  }

  mime(extname) {
    let extType = '';
    switch (extname) {
      case '.html':
        extType = 'text/html';
        break;
      case '.css':
        extType = 'text/css';
        break;
      case '.js':
        extType = 'text/javascript';
        break;
      default:
        extType = 'text/html';
    }
    return extType;
  }

  handlePost(req, res) {
    const chunk = [];
    req.on('data', data => {
      chunk.push(data);
    });

    req.on('end', () => {
      try {
        const jData = JSON.parse(chunk.toString());
        console.log(jData);
        switch (jData.action) {
          case 'getOSp':
            this.getOSp(req, res, jData);
            break;
          case 'addSp':
            this.addSp(req, res, jData);
            break;
          case 'getSps':
            this.getSps(req, res, jData);
            break;
          case 'editSp':
            this.editSp(req, res, jData);
            break;
          case 'delSp':
            this.delSp(req, res, jData);
            break;
          default:
            res.writeHead(404, {'Content-Type': 'text/html;charset="utf-8"'});
            res.end();
        }
      } catch(e) {
        res.writeHead(500, {'Content-Type': 'text/html;charset="utf-8"'});
        res.end();
      }
    });
  }

  writeJson(res, data) {
    res.writeHead(200, {'Content-Type': 'application/json;charset="utf-8"'});
    res.write(JSON.stringify(data));
    res.end();
  }

  async getOSp(req, res, jsonData) {
    const list = await cache.getOriginalSp();
    this.writeJson(res, {
      code: 0,
      data: list
    });
  }

  async addSp(req, res, jsonData) {
    const data = await cache.addSp(jsonData.data);
    if (!data) {
      return this.writeJson({
        code: 1001,
      });
    }

    this.writeJson(res, {
      code: 0,
      data,
    });
  }

  async getSps(req, res, jsonData) {
    const data = await cache.getSps();
    this.writeJson(res, {
      code: 0,
      data,
    });
  }

  async editSp(req, res, jsonData) {
    const data = await cache.editSp(jsonData.data);
    if (!data) {
      return this.writeJson({
        code: 1002,
      });
    }

    this.writeJson(res, {
      code: 0,
      data,
    });
  }

  async delSp(req, res, jsonData) {
    const data = await cache.delSp(jsonData.data);
    if (!data) {
      return this.writeJson({
        code: 1003,
      });
    }

    this.writeJson(res, {
      code: 0,
      data,
    });
  }
}

module.exports = Http;