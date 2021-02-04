'use strict';

const fs = require('fs');
const path = require('path');
const serialport = require('serialport');

const SerialPort = require('./serialport');
const Ntripcaster = require('./ntrip');

const spFile = path.join(process.app.dataRoot, 'sp.json');
const ntripFile = path.join(process.app.dataRoot, 'ntrip.json');

const SPS = [];
const NTRIPS = [];


const syncSps = (cfgs) => {
  for (const i in cfgs) {
    const item = cfgs[i];
    let isFound = false;
    for (const j in SPS) {
      const spInstance = SPS[j];
      if (spInstance.isEqual(item)) {
        isFound = true;
        spInstance.updateCfg(item);
        break;
      }
    }
    if (!isFound) {
      const spInstance = new SerialPort(item);
      SPS.push(spInstance);
      spInstance.run();
    }
  }

  const removeKeys = [];
  for (const i in SPS) {
    const spInstance = SPS[i];
    let isFound = false;
    for (const j in cfgs) {
      if (spInstance.isEqual(cfgs[j])) {
        isFound = true;
        break;
      }
    }
    if (!isFound) {
      spInstance.close();
      removeKeys.push(i);
    }
  }

  removeKeys.reverse();

  for (const i in removeKeys) {
    SPS.splice(removeKeys[i], 1);
  }
}

const syncNtrips = (cfgs) => {
  for (const i in cfgs) {
    const item = cfgs[i];
    let isFound = false;
    for (const j in NTRIPS) {
      const ntripInstance = NTRIPS[j];
      if (ntripInstance.isEqual(item)) {
        isFound = true;
        ntripInstance.updateCfg(Object.assign(item, {idx: i}));
        break;
      }
    }
    if (!isFound) {
      const ntripInstance = new Ntripcaster(Object.assign(item, {idx: i}));
      NTRIPS.push(ntripInstance);
      ntripInstance.run();
    }
  }

  const removeKeys = [];
  for (const i in NTRIPS) {
    const ntripInstance = NTRIPS[i];
    let isFound = false;
    for (const j in cfgs) {
      if (ntripInstance.isEqual(cfgs[j])) {
        isFound = true;
        break;
      }
    }
    if (!isFound) {
      ntripInstance.close();
      removeKeys.push(i);
    }
  }

  removeKeys.reverse();

  for (const i in removeKeys) {
    NTRIPS.splice(removeKeys[i], 1);
  }
}


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
  syncSps(data);
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
  syncNtrips(data);
}

exports.initSerialport = () => {
  const data = getSpCfg();

  syncSps(data);
}

exports.initNtripcaster = () => {
  const data = getNtripCfg();

  syncNtrips(data);
}

exports.getOriginalSp = async () => {
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

exports.addSp = (data) => {
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

exports.getSps = () => {
  const data = getSpCfg();
  return data;
}

exports.editSp = (data) => {
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

exports.delSp = (data) => {
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

exports.addNtrip = (data) => {
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

exports.editNtrip = (data) => {
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

exports.delNtrip = (data) => {
  const idx = data.idx;
  const cfgs = getNtripCfg();
  if (!cfgs[idx]) {
    return null;
  }

  cfgs.splice(idx, 1);
  saveNtripCfg(cfgs);
  return cfgs;
}

exports.sendGGAToNtrip = (gga) => {
  for (const i in NTRIPS) {
    NTRIPS[i].sendGGA(gga);
  }
}

exports.sendRTCMToSp = (rtcm) => {
  for (const i in SPS) {
    SPS[i].sendRTCM(rtcm);
  }
}