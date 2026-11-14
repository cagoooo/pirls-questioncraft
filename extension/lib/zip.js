// 最小的 ZIP 打包（只存放、不壓縮）：把 Excel 和截圖包成一個檔案，PaGamO 批量上傳頁可以直接收壓縮檔。
// JPG 與 xlsx 本身已經壓縮過，再壓縮也省不了多少，所以用「只存放」最單純。
// 一般 script（不是 module），網頁與 Node 測試都能載入。
(function (global) {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // DOS 格式的日期時間（ZIP 規定的寫法）
  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  /**
   * @param files [{ name: string, bytes: Uint8Array }]
   * @returns Uint8Array（ZIP 檔內容）
   */
  function makeZip(files, when) {
    var enc = new TextEncoder();
    var t = dosTime(when || new Date());
    var locals = [];
    var centrals = [];
    var offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var data = f.bytes;
      var crc = crc32(data);
      var local = new Uint8Array(30 + name.length);
      var v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);         // 解壓需要的版本
      v.setUint16(6, 0x0800, true);     // 檔名用 UTF-8（中文檔名不會變亂碼）
      v.setUint16(8, 0, true);          // 只存放、不壓縮
      v.setUint16(10, t.time, true);
      v.setUint16(12, t.date, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true);
      v.setUint16(28, 0, true);
      local.set(name, 30);
      locals.push(local, data);

      var central = new Uint8Array(46 + name.length);
      var w = new DataView(central.buffer);
      w.setUint32(0, 0x02014b50, true);
      w.setUint16(4, 20, true);
      w.setUint16(6, 20, true);
      w.setUint16(8, 0x0800, true);
      w.setUint16(10, 0, true);
      w.setUint16(12, t.time, true);
      w.setUint16(14, t.date, true);
      w.setUint32(16, crc, true);
      w.setUint32(20, data.length, true);
      w.setUint32(24, data.length, true);
      w.setUint16(28, name.length, true);
      w.setUint32(42, offset, true);
      central.set(name, 46);
      centrals.push(central);
      offset += local.length + data.length;
    });
    var centralSize = centrals.reduce(function (a, c) { return a + c.length; }, 0);
    var end = new Uint8Array(22);
    var e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);
    var parts = locals.concat(centrals, [end]);
    var out = new Uint8Array(parts.reduce(function (a, p) { return a + p.length; }, 0));
    var pos = 0;
    parts.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  global.PirlsZip = { makeZip: makeZip, crc32: crc32 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
