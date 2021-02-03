'use strict';

const fs = require('fs');
const path = require('path');
const serialport = require('serialport');

const spFile = path.join(process.app.dataRoot, 'sp.json');
const ntripFile = path.join(process.app.dataRoot, 'ntrip.json');

const SPS = [];
const NTRIPS = [];

const getSpCfg = () => {
  let data = [];
  if (fs.existsSync(spFile)) {
    const fileData = fs.readFileSync(spFile);
    data = JSON.parse(fileData);
  }

  return data;
}

const saveSpCfg = (data) => {
  fs.writeFileSync(spFile, JSON.stringify(data, null, 2));
}

const getNtripCfg = () => {
  let data = [];
  if (fs.existsSync(ntripFile)) {
    const fileData = fs.readFileSync(ntripFile);
    data = JSON.parse(fileData);
  }

  return data;
}

const saveNtripCfg = (data) => {
  fs.writeFileSync(ntripFile, JSON.stringify(data, null, 2));
}

const initSerialport = () => {
  const data = getSpCfg();

}

const initNtripcaster = () => {}

const getOriginalSp = async () => {
  const list = await serialport.list();
  const cfgs = getSpCfg();

  const data = [];
  for (const i in list) {
    let isFound = false;
    for (const j in cfgs) {
      if (list[i].path === cfgs[j].name) {
        isFound = true;
        break;
      }
    }

    data.push({
      name: list[i].path,
      disabled: isFound
    });
  }

  return data;
}

const addSp = (data) => {
  const cfgs = getSpCfg();
  for (const i in cfgs) {
    if (cfgs[i].name === data.name) {
      return null;
    }
  }

  cfgs.push(data);
  saveSpCfg(cfgs);
  return cfgs;
}

const getSps = () => {
  const data = getSpCfg();
  return data;
}

const editSp = (data) => {
  const cfgs = getSpCfg();
  const idx = data.idx;
  if (!cfgs[idx]) {
    return null;
  }

  delete data.idx;
  cfgs[idx] = data;
  saveSpCfg(cfgs);
  return cfgs;
}

const delSp = (data) => {
  const idx = data.idx;
  const cfgs = getSpCfg();
  if (!cfgs[idx]) {
    return null;
  }

  cfgs.splice(idx, 1);
  saveSpCfg(cfgs);
  return cfgs;
}

const getNtrips = () => {
  const data = getNtripCfg();
  return data;
}

const addNtrip = (data) => {
  const cfgs = getNtripCfg();
  for (const i in cfgs) {
    const item = cfgs[i];
    if (item.host === data.host && item.port === data.port &&
      item.username === data.username && item.password === data.password &&
      item.mountpoint === data.mountpoint) {
        return null;
    }
  }

  cfgs.push(data);
  saveNtripCfg(cfgs);
  return cfgs;
}

const editNtrip = (data) => {
  const cfgs = getNtripCfg();

  for (const i in cfgs) {
    const item = cfgs[i];
    const idx = parseInt(i);
    if (item.host === data.host && item.port === data.port &&
      item.username === data.username && item.password === data.password &&
      item.mountpoint === data.mountpoint && data.idx !== idx) {
        return null;
    }
  }

  const idx = data.idx;
  if (!cfgs[idx]) {
    return null;
  }

  delete data.idx;
  cfgs[idx] = data;
  saveNtripCfg(cfgs);
  return cfgs;
}

const delNtrip = (data) => {
  const idx = data.idx;
  const cfgs = getNtripCfg();
  if (!cfgs[idx]) {
    return null;
  }

  cfgs.splice(idx, 1);
  saveNtripCfg(cfgs);
  return cfgs;
}

module.exports = {
  initSerialport,
  initNtripcaster,
  getOriginalSp,
  addSp,
  getSps,
  editSp,
  delSp,
  getNtrips,
  addNtrip,
  editNtrip,
  delNtrip,
};