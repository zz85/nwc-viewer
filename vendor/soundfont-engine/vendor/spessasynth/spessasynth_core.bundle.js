var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// node_modules/spessasynth_core/dist/index.js
var __require2 = /* @__PURE__ */ ((x) => __require)(function(x) {
  if (true)
    return __require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var IndexedByteArray = class extends Uint8Array {
  currentIndex = 0;
  slice(start, end) {
    const a = super.slice(start, end);
    a.currentIndex = 0;
    return a;
  }
};
function readBinaryString(dataArray, bytes = dataArray.length, offset = 0) {
  let string = "";
  for (let i = 0;i < bytes; i++) {
    const byte = dataArray[offset + i];
    if (byte === 0) {
      return string;
    }
    string += String.fromCharCode(byte);
  }
  return string;
}
function readBinaryStringIndexed(dataArray, bytes) {
  const startIndex = dataArray.currentIndex;
  dataArray.currentIndex += bytes;
  return readBinaryString(dataArray, bytes, startIndex);
}
function getStringBytes(string, addZero = false, ensureEven = false) {
  let len = string.length;
  if (addZero) {
    len++;
  }
  if (ensureEven && len % 2 !== 0) {
    len++;
  }
  const arr = new IndexedByteArray(len);
  writeBinaryStringIndexed(arr, string);
  return arr;
}
function writeBinaryStringIndexed(outArray, string, padLength = 0) {
  if (padLength > 0) {
    if (string.length > padLength) {
      string = string.slice(0, padLength);
    }
  }
  for (let i = 0;i < string.length; i++) {
    outArray[outArray.currentIndex++] = string.charCodeAt(i);
  }
  if (padLength > string.length) {
    for (let i = 0;i < padLength - string.length; i++) {
      outArray[outArray.currentIndex++] = 0;
    }
  }
  return outArray;
}
function readLittleEndianIndexed(dataArray, bytesAmount) {
  const res = readLittleEndian(dataArray, bytesAmount, dataArray.currentIndex);
  dataArray.currentIndex += bytesAmount;
  return res;
}
function readLittleEndian(dataArray, bytesAmount, offset = 0) {
  let out = 0;
  for (let i = 0;i < bytesAmount; i++) {
    out |= dataArray[offset + i] << i * 8;
  }
  return out >>> 0;
}
function writeLittleEndianIndexed(dataArray, number, byteTarget) {
  for (let i = 0;i < byteTarget; i++) {
    dataArray[dataArray.currentIndex++] = number >> i * 8 & 255;
  }
}
function writeWord(dataArray, word) {
  dataArray[dataArray.currentIndex++] = word & 255;
  dataArray[dataArray.currentIndex++] = word >> 8;
}
function writeDword(dataArray, dword) {
  writeLittleEndianIndexed(dataArray, dword, 4);
}
function signedInt16(byte1, byte2) {
  const val = byte2 << 8 | byte1;
  if (val > 32767) {
    return val - 65536;
  }
  return val;
}
function signedInt8(byte) {
  if (byte > 127) {
    return byte - 256;
  }
  return byte;
}
var RIFFChunk = class {
  header;
  size;
  data;
  constructor(header, size, data) {
    this.header = header;
    this.size = size;
    this.data = data;
  }
};
function readRIFFChunk(dataArray, readData = true, forceShift = false) {
  const header = readBinaryStringIndexed(dataArray, 4);
  let size = readLittleEndianIndexed(dataArray, 4);
  if (header === "") {
    size = 0;
  }
  let chunkData;
  if (readData) {
    chunkData = dataArray.slice(dataArray.currentIndex, dataArray.currentIndex + size);
  } else {
    chunkData = new IndexedByteArray(0);
  }
  if (readData || forceShift) {
    dataArray.currentIndex += size;
    if (size % 2 !== 0) {
      dataArray.currentIndex++;
    }
  }
  return new RIFFChunk(header, size, chunkData);
}
function writeRIFFChunkRaw(header, data, addZeroByte = false, isList = false) {
  if (header.length !== 4) {
    throw new Error(`Invalid header length: ${header}`);
  }
  let dataStartOffset = 8;
  let headerWritten = header;
  let dataLength = data.length;
  if (addZeroByte) {
    dataLength++;
  }
  let writtenSize = dataLength;
  if (isList) {
    dataStartOffset += 4;
    writtenSize += 4;
    headerWritten = "LIST";
  }
  let finalSize = dataStartOffset + dataLength;
  if (finalSize % 2 !== 0) {
    finalSize++;
  }
  const outArray = new IndexedByteArray(finalSize);
  writeBinaryStringIndexed(outArray, headerWritten);
  writeDword(outArray, writtenSize);
  if (isList) {
    writeBinaryStringIndexed(outArray, header);
  }
  outArray.set(data, dataStartOffset);
  return outArray;
}
function writeRIFFChunkParts(header, chunks, isList = false) {
  let dataOffset = 8;
  let headerWritten = header;
  const dataLength = chunks.reduce((len, c) => c.length + len, 0);
  let writtenSize = dataLength;
  if (isList) {
    dataOffset += 4;
    writtenSize += 4;
    headerWritten = "LIST";
  }
  let finalSize = dataOffset + dataLength;
  if (finalSize % 2 !== 0) {
    finalSize++;
  }
  const outArray = new IndexedByteArray(finalSize);
  writeBinaryStringIndexed(outArray, headerWritten);
  writeDword(outArray, writtenSize);
  if (isList) {
    writeBinaryStringIndexed(outArray, header);
  }
  chunks.forEach((c) => {
    outArray.set(c, dataOffset);
    dataOffset += c.length;
  });
  return outArray;
}
function findRIFFListType(collection, type) {
  return collection.find((c) => {
    if (c.header !== "LIST") {
      return false;
    }
    c.data.currentIndex = 4;
    return readBinaryString(c.data, 4) === type;
  });
}
function fillWithDefaults(obj, defObj) {
  return {
    ...defObj,
    ...obj ?? {}
  };
}
function readBigEndian(dataArray, bytesAmount, offset = 0) {
  let out = 0;
  for (let i = 0;i < bytesAmount; i++) {
    out = out << 8 | dataArray[offset + i];
  }
  return out >>> 0;
}
function readBigEndianIndexed(dataArray, bytesAmount) {
  const res = readBigEndian(dataArray, bytesAmount, dataArray.currentIndex);
  dataArray.currentIndex += bytesAmount;
  return res;
}
function writeBigEndian(number, bytesAmount) {
  const bytes = new Array(bytesAmount).fill(0);
  for (let i = bytesAmount - 1;i >= 0; i--) {
    bytes[i] = number & 255;
    number >>= 8;
  }
  return bytes;
}
function readVariableLengthQuantity(MIDIbyteArray) {
  let out = 0;
  while (MIDIbyteArray) {
    const byte = MIDIbyteArray[MIDIbyteArray.currentIndex++];
    out = out << 7 | byte & 127;
    if (byte >> 7 !== 1) {
      break;
    }
  }
  return out;
}
function writeVariableLengthQuantity(number) {
  const bytes = [number & 127];
  number >>= 7;
  while (number > 0) {
    bytes.unshift(number & 127 | 128);
    number >>= 7;
  }
  return bytes;
}
function formatTime(totalSeconds) {
  totalSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds - minutes * 60);
  return {
    minutes,
    seconds,
    time: `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  };
}
function arrayToHexString(arr) {
  let hexString = "";
  for (const i of arr) {
    const hex = i.toString(16).padStart(2, "0").toUpperCase();
    hexString += hex;
    hexString += " ";
  }
  return hexString;
}
var consoleColors = {
  warn: "color: orange;",
  unrecognized: "color: red;",
  info: "color: aqua;",
  recognized: "color: lime",
  value: "color: yellow; background-color: black;"
};
var tr;
(() => {
  var l = Uint8Array, T = Uint16Array, ur = Int32Array, W = new l([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]), X = new l([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]), wr = new l([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]), Y = function(r, a) {
    for (var e = new T(31), f = 0;f < 31; ++f)
      e[f] = a += 1 << r[f - 1];
    for (var v = new ur(e[30]), f = 1;f < 30; ++f)
      for (var g = e[f];g < e[f + 1]; ++g)
        v[g] = g - e[f] << 5 | f;
    return { b: e, r: v };
  }, Z = Y(W, 2), $ = Z.b, cr = Z.r;
  $[28] = 258, cr[258] = 28;
  var j = Y(X, 0), hr = j.b, Fr = j.r, _ = new T(32768);
  for (i = 0;i < 32768; ++i)
    c = (i & 43690) >> 1 | (i & 21845) << 1, c = (c & 52428) >> 2 | (c & 13107) << 2, c = (c & 61680) >> 4 | (c & 3855) << 4, _[i] = ((c & 65280) >> 8 | (c & 255) << 8) >> 1;
  var c, i, A = function(r, a, e) {
    for (var f = r.length, v = 0, g = new T(a);v < f; ++v)
      r[v] && ++g[r[v] - 1];
    var k = new T(a);
    for (v = 1;v < a; ++v)
      k[v] = k[v - 1] + g[v - 1] << 1;
    var b;
    if (e) {
      b = new T(1 << a);
      var m = 15 - a;
      for (v = 0;v < f; ++v)
        if (r[v])
          for (var U = v << 4 | r[v], x = a - r[v], n = k[r[v] - 1]++ << x, o = n | (1 << x) - 1;n <= o; ++n)
            b[_[n] >> m] = U;
    } else
      for (b = new T(f), v = 0;v < f; ++v)
        r[v] && (b[v] = _[k[r[v] - 1]++] >> 15 - r[v]);
    return b;
  }, M = new l(288);
  for (i = 0;i < 144; ++i)
    M[i] = 8;
  var i;
  for (i = 144;i < 256; ++i)
    M[i] = 9;
  var i;
  for (i = 256;i < 280; ++i)
    M[i] = 7;
  var i;
  for (i = 280;i < 288; ++i)
    M[i] = 8;
  var i, L = new l(32);
  for (i = 0;i < 32; ++i)
    L[i] = 5;
  var i, gr = A(M, 9, 1), br = A(L, 5, 1), q = function(r) {
    for (var a = r[0], e = 1;e < r.length; ++e)
      r[e] > a && (a = r[e]);
    return a;
  }, u = function(r, a, e) {
    var f = a / 8 | 0;
    return (r[f] | r[f + 1] << 8) >> (a & 7) & e;
  }, C = function(r, a) {
    var e = a / 8 | 0;
    return (r[e] | r[e + 1] << 8 | r[e + 2] << 16) >> (a & 7);
  }, kr = function(r) {
    return (r + 7) / 8 | 0;
  }, xr = function(r, a, e) {
    return (a == null || a < 0) && (a = 0), (e == null || e > r.length) && (e = r.length), new l(r.subarray(a, e));
  }, yr = ["unexpected EOF", "invalid block type", "invalid length/literal", "invalid distance", "stream finished", "no stream handler", , "no callback", "invalid UTF-8 data", "extra field too long", "date not in range 1980-2099", "filename too long", "stream finishing", "invalid zip data"], h = function(r, a, e) {
    var f = new Error(a || yr[r]);
    if (f.code = r, Error.captureStackTrace && Error.captureStackTrace(f, h), !e)
      throw f;
    return f;
  }, Sr = function(r, a, e, f) {
    var v = r.length, g = f ? f.length : 0;
    if (!v || a.f && !a.l)
      return e || new l(0);
    var k = !e, b = k || a.i != 2, m = a.i;
    k && (e = new l(v * 3));
    var U = function(fr) {
      var or = e.length;
      if (fr > or) {
        var lr = new l(Math.max(or * 2, fr));
        lr.set(e), e = lr;
      }
    }, x = a.f || 0, n = a.p || 0, o = a.b || 0, S = a.l, I = a.d, z = a.m, D = a.n, G = v * 8;
    do {
      if (!S) {
        x = u(r, n, 1);
        var H = u(r, n + 1, 3);
        if (n += 3, H)
          if (H == 1)
            S = gr, I = br, z = 9, D = 5;
          else if (H == 2) {
            var N = u(r, n, 31) + 257, s = u(r, n + 10, 15) + 4, d = N + u(r, n + 5, 31) + 1;
            n += 14;
            for (var F = new l(d), P = new l(19), t = 0;t < s; ++t)
              P[wr[t]] = u(r, n + t * 3, 7);
            n += s * 3;
            for (var rr = q(P), Ar = (1 << rr) - 1, Mr = A(P, rr, 1), t = 0;t < d; ) {
              var ar = Mr[u(r, n, Ar)];
              n += ar & 15;
              var w = ar >> 4;
              if (w < 16)
                F[t++] = w;
              else {
                var E = 0, O = 0;
                for (w == 16 ? (O = 3 + u(r, n, 3), n += 2, E = F[t - 1]) : w == 17 ? (O = 3 + u(r, n, 7), n += 3) : w == 18 && (O = 11 + u(r, n, 127), n += 7);O--; )
                  F[t++] = E;
              }
            }
            var er = F.subarray(0, N), y = F.subarray(N);
            z = q(er), D = q(y), S = A(er, z, 1), I = A(y, D, 1);
          } else
            h(1);
        else {
          var w = kr(n) + 4, J = r[w - 4] | r[w - 3] << 8, K = w + J;
          if (K > v) {
            m && h(0);
            break;
          }
          b && U(o + J), e.set(r.subarray(w, K), o), a.b = o += J, a.p = n = K * 8, a.f = x;
          continue;
        }
        if (n > G) {
          m && h(0);
          break;
        }
      }
      b && U(o + 131072);
      for (var Ur = (1 << z) - 1, zr = (1 << D) - 1, Q = n;; Q = n) {
        var E = S[C(r, n) & Ur], p = E >> 4;
        if (n += E & 15, n > G) {
          m && h(0);
          break;
        }
        if (E || h(2), p < 256)
          e[o++] = p;
        else if (p == 256) {
          Q = n, S = null;
          break;
        } else {
          var nr = p - 254;
          if (p > 264) {
            var t = p - 257, B = W[t];
            nr = u(r, n, (1 << B) - 1) + $[t], n += B;
          }
          var R = I[C(r, n) & zr], V = R >> 4;
          R || h(3), n += R & 15;
          var y = hr[V];
          if (V > 3) {
            var B = X[V];
            y += C(r, n) & (1 << B) - 1, n += B;
          }
          if (n > G) {
            m && h(0);
            break;
          }
          b && U(o + 131072);
          var vr = o + nr;
          if (o < y) {
            var ir = g - y, Dr = Math.min(y, vr);
            for (ir + o < 0 && h(3);o < Dr; ++o)
              e[o] = f[ir + o];
          }
          for (;o < vr; ++o)
            e[o] = e[o - y];
        }
      }
      a.l = S, a.p = Q, a.b = o, a.f = x, S && (x = 1, a.m = z, a.d = I, a.n = D);
    } while (!x);
    return o != e.length && k ? xr(e, 0, o) : e.subarray(0, o);
  }, Tr = new l(0);
  function mr(r, a) {
    return Sr(r, { i: 2 }, a && a.out, a && a.dictionary);
  }
  var Er = typeof TextDecoder < "u" && new TextDecoder, pr = 0;
  try {
    Er.decode(Tr, { stream: true }), pr = 1;
  } catch {}
  tr = mr;
})();
var inf = tr;
var ENABLE_INFO = false;
var ENABLE_WARN = true;
var ENABLE_GROUP = false;
function SpessaSynthInfo(...message) {
  if (ENABLE_INFO) {
    console.info(...message);
  }
}
function SpessaSynthWarn(...message) {
  if (ENABLE_WARN) {
    console.warn(...message);
  }
}
function SpessaSynthGroup(...message) {
  if (ENABLE_GROUP) {
    console.group(...message);
  }
}
function SpessaSynthGroupCollapsed(...message) {
  if (ENABLE_GROUP) {
    console.groupCollapsed(...message);
  }
}
function SpessaSynthGroupEnd() {
  if (ENABLE_GROUP) {
    console.groupEnd();
  }
}
var MIDIMessage = class {
  ticks;
  statusByte;
  data;
  constructor(ticks, byte, data) {
    this.ticks = ticks;
    this.statusByte = byte;
    this.data = data;
  }
};
function getChannel(statusByte) {
  const eventType = statusByte & 240;
  const channel = statusByte & 15;
  let resultChannel = channel;
  switch (eventType) {
    case 128:
    case 144:
    case 160:
    case 176:
    case 192:
    case 208:
    case 224:
      break;
    case 240:
      switch (channel) {
        case 0:
          resultChannel = -3;
          break;
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 14:
          resultChannel = -1;
          break;
        case 15:
          resultChannel = -2;
          break;
      }
      break;
    default:
      resultChannel = -1;
  }
  return resultChannel;
}
function getEvent(statusByte) {
  const status = statusByte & 240;
  const channel = statusByte & 15;
  let eventChannel = -1;
  let eventStatus = statusByte;
  if (status >= 128 && status <= 224) {
    eventChannel = channel;
    eventStatus = status;
  }
  return {
    status: eventStatus,
    channel: eventChannel
  };
}
var dataBytesAmount = {
  8: 2,
  9: 2,
  10: 2,
  11: 2,
  12: 1,
  13: 1,
  14: 2
};
var midiMessageTypes = {
  noteOff: 128,
  noteOn: 144,
  polyPressure: 160,
  controllerChange: 176,
  programChange: 192,
  channelPressure: 208,
  pitchWheel: 224,
  systemExclusive: 240,
  timecode: 241,
  songPosition: 242,
  songSelect: 243,
  tuneRequest: 246,
  clock: 248,
  start: 250,
  continue: 251,
  stop: 252,
  activeSensing: 254,
  reset: 255,
  sequenceNumber: 0,
  text: 1,
  copyright: 2,
  trackName: 3,
  instrumentName: 4,
  lyric: 5,
  marker: 6,
  cuePoint: 7,
  programName: 8,
  midiChannelPrefix: 32,
  midiPort: 33,
  endOfTrack: 47,
  setTempo: 81,
  smpteOffset: 84,
  timeSignature: 88,
  keySignature: 89,
  sequenceSpecific: 127
};
var midiControllers = {
  bankSelect: 0,
  modulationWheel: 1,
  breathController: 2,
  undefinedCC3: 3,
  footController: 4,
  portamentoTime: 5,
  dataEntryMSB: 6,
  mainVolume: 7,
  balance: 8,
  undefinedCC9: 9,
  pan: 10,
  expressionController: 11,
  effectControl1: 12,
  effectControl2: 13,
  undefinedCC14: 14,
  undefinedCC15: 15,
  generalPurposeController1: 16,
  generalPurposeController2: 17,
  generalPurposeController3: 18,
  generalPurposeController4: 19,
  undefinedCC20: 20,
  undefinedCC21: 21,
  undefinedCC22: 22,
  undefinedCC23: 23,
  undefinedCC24: 24,
  undefinedCC25: 25,
  undefinedCC26: 26,
  undefinedCC27: 27,
  undefinedCC28: 28,
  undefinedCC29: 29,
  undefinedCC30: 30,
  undefinedCC31: 31,
  bankSelectLSB: 32,
  modulationWheelLSB: 33,
  breathControllerLSB: 34,
  undefinedCC3LSB: 35,
  footControllerLSB: 36,
  portamentoTimeLSB: 37,
  dataEntryLSB: 38,
  mainVolumeLSB: 39,
  balanceLSB: 40,
  undefinedCC9LSB: 41,
  panLSB: 42,
  expressionControllerLSB: 43,
  effectControl1LSB: 44,
  effectControl2LSB: 45,
  undefinedCC14LSB: 46,
  undefinedCC15LSB: 47,
  undefinedCC16LSB: 48,
  undefinedCC17LSB: 49,
  undefinedCC18LSB: 50,
  undefinedCC19LSB: 51,
  undefinedCC20LSB: 52,
  undefinedCC21LSB: 53,
  undefinedCC22LSB: 54,
  undefinedCC23LSB: 55,
  undefinedCC24LSB: 56,
  undefinedCC25LSB: 57,
  undefinedCC26LSB: 58,
  undefinedCC27LSB: 59,
  undefinedCC28LSB: 60,
  undefinedCC29LSB: 61,
  undefinedCC30LSB: 62,
  undefinedCC31LSB: 63,
  sustainPedal: 64,
  portamentoOnOff: 65,
  sostenutoPedal: 66,
  softPedal: 67,
  legatoFootswitch: 68,
  hold2Pedal: 69,
  soundVariation: 70,
  filterResonance: 71,
  releaseTime: 72,
  attackTime: 73,
  brightness: 74,
  decayTime: 75,
  vibratoRate: 76,
  vibratoDepth: 77,
  vibratoDelay: 78,
  soundController10: 79,
  generalPurposeController5: 80,
  generalPurposeController6: 81,
  generalPurposeController7: 82,
  generalPurposeController8: 83,
  portamentoControl: 84,
  undefinedCC85: 85,
  undefinedCC86: 86,
  undefinedCC87: 87,
  undefinedCC88: 88,
  undefinedCC89: 89,
  undefinedCC90: 90,
  reverbDepth: 91,
  tremoloDepth: 92,
  chorusDepth: 93,
  detuneDepth: 94,
  phaserDepth: 95,
  dataIncrement: 96,
  dataDecrement: 97,
  nonRegisteredParameterLSB: 98,
  nonRegisteredParameterMSB: 99,
  registeredParameterLSB: 100,
  registeredParameterMSB: 101,
  undefinedCC102LSB: 102,
  undefinedCC103LSB: 103,
  undefinedCC104LSB: 104,
  undefinedCC105LSB: 105,
  undefinedCC106LSB: 106,
  undefinedCC107LSB: 107,
  undefinedCC108LSB: 108,
  undefinedCC109LSB: 109,
  undefinedCC110LSB: 110,
  undefinedCC111LSB: 111,
  undefinedCC112LSB: 112,
  undefinedCC113LSB: 113,
  undefinedCC114LSB: 114,
  undefinedCC115LSB: 115,
  undefinedCC116LSB: 116,
  undefinedCC117LSB: 117,
  undefinedCC118LSB: 118,
  undefinedCC119LSB: 119,
  allSoundOff: 120,
  resetAllControllers: 121,
  localControlOnOff: 122,
  allNotesOff: 123,
  omniModeOff: 124,
  omniModeOn: 125,
  monoModeOn: 126,
  polyModeOn: 127
};
function writeMIDIInternal(midi) {
  if (!midi.tracks) {
    throw new Error("MIDI has no tracks!");
  }
  const binaryTrackData = [];
  for (const track of midi.tracks) {
    const binaryTrack = [];
    let currentTick = 0;
    let runningByte = undefined;
    for (const event of track.events) {
      const deltaTicks = Math.max(0, event.ticks - currentTick);
      if (event.statusByte === midiMessageTypes.endOfTrack) {
        currentTick += deltaTicks;
        continue;
      }
      let messageData;
      if (event.statusByte <= midiMessageTypes.sequenceSpecific) {
        messageData = [
          255,
          event.statusByte,
          ...writeVariableLengthQuantity(event.data.length),
          ...event.data
        ];
        runningByte = undefined;
      } else if (event.statusByte === midiMessageTypes.systemExclusive) {
        messageData = [
          240,
          ...writeVariableLengthQuantity(event.data.length),
          ...event.data
        ];
        runningByte = undefined;
      } else {
        messageData = [];
        if (runningByte !== event.statusByte) {
          runningByte = event.statusByte;
          messageData.push(event.statusByte);
        }
        messageData.push(...event.data);
      }
      binaryTrack.push(...writeVariableLengthQuantity(deltaTicks));
      binaryTrack.push(...messageData);
      currentTick += deltaTicks;
    }
    binaryTrack.push(0);
    binaryTrack.push(255);
    binaryTrack.push(midiMessageTypes.endOfTrack);
    binaryTrack.push(0);
    binaryTrackData.push(new Uint8Array(binaryTrack));
  }
  const writeText = (text, arr) => {
    for (let i = 0;i < text.length; i++) {
      arr.push(text.charCodeAt(i));
    }
  };
  const binaryData = [];
  writeText("MThd", binaryData);
  binaryData.push(...writeBigEndian(6, 4));
  binaryData.push(0, midi.format);
  binaryData.push(...writeBigEndian(midi.tracks.length, 2));
  binaryData.push(...writeBigEndian(midi.timeDivision, 2));
  for (const track of binaryTrackData) {
    writeText("MTrk", binaryData);
    binaryData.push(...writeBigEndian(track.length, 4));
    binaryData.push(...track);
  }
  return new Uint8Array(binaryData).buffer;
}
var VOICE_CAP = 350;
var DEFAULT_PERCUSSION = 9;
var MIDI_CHANNEL_COUNT = 16;
var DEFAULT_SYNTH_MODE = "gs";
var ALL_CHANNELS_OR_DIFFERENT_ACTION = -1;
var EMBEDDED_SOUND_BANK_ID = `SPESSASYNTH_EMBEDDED_BANK_${Math.random()}_DO_NOT_DELETE`;
var GENERATOR_OVERRIDE_NO_CHANGE_VALUE = 32767;
var DEFAULT_SYNTH_METHOD_OPTIONS = {
  time: 0
};
var MIN_NOTE_LENGTH = 0.03;
var MIN_EXCLUSIVE_LENGTH = 0.07;
var SYNTHESIZER_GAIN = 1;
var XG_SFX_VOICE = 64;
var GM2_DEFAULT_BANK = 121;
var BankSelectHacks = class {
  static getDefaultBank(sys) {
    return sys === "gm2" ? GM2_DEFAULT_BANK : 0;
  }
  static getDrumBank(sys) {
    switch (sys) {
      default:
        throw new Error(`${sys} doesn't have a bank MSB for drums.`);
      case "gm2":
        return 120;
      case "xg":
        return 127;
    }
  }
  static isXGDrums(bankMSB) {
    return bankMSB === 120 || bankMSB === 127;
  }
  static isValidXGMSB(bankMSB) {
    return this.isXGDrums(bankMSB) || bankMSB === XG_SFX_VOICE || bankMSB === GM2_DEFAULT_BANK;
  }
  static isSystemXG(system) {
    return system === "gm2" || system === "xg";
  }
  static addBankOffset(bankMSB, bankOffset, xgDrums = true) {
    if (this.isXGDrums(bankMSB) && xgDrums) {
      return bankMSB;
    }
    return Math.min(bankMSB + bankOffset, 127);
  }
  static subtrackBankOffset(bankMSB, bankOffset, xgDrums = true) {
    if (this.isXGDrums(bankMSB) && xgDrums) {
      return bankMSB;
    }
    return Math.max(0, bankMSB - bankOffset);
  }
};
function isXGOn(e) {
  return e.data[0] === 67 && e.data[2] === 76 && e.data[5] === 126 && e.data[6] === 0;
}
function isGSDrumsOn(e) {
  return e.data[0] === 65 && e.data[2] === 66 && e.data[3] === 18 && e.data[4] === 64 && (e.data[5] & 16) !== 0 && e.data[6] === 21;
}
function isGSOn(e) {
  return e.data[0] === 65 && e.data[2] === 66 && e.data[6] === 127;
}
function isGMOn(e) {
  return e.data[0] === 126 && e.data[2] === 9 && e.data[3] === 1;
}
function isGM2On(e) {
  return e.data[0] === 126 && e.data[2] === 9 && e.data[3] === 3;
}
function getGsOn(ticks) {
  return new MIDIMessage(ticks, midiMessageTypes.systemExclusive, new IndexedByteArray([
    65,
    16,
    66,
    18,
    64,
    0,
    127,
    0,
    65,
    247
  ]));
}
var MIDIPatchTools = class _MIDIPatchTools {
  static toMIDIString(patch) {
    if (patch.isGMGSDrum) {
      return `DRUM:${patch.program}`;
    }
    return `${patch.bankLSB}:${patch.bankMSB}:${patch.program}`;
  }
  static fromMIDIString(string) {
    const parts = string.split(":");
    if (parts.length > 3 || parts.length < 2) {
      throw new Error("Invalid MIDI string:");
    }
    if (string.startsWith("DRUM")) {
      return {
        bankMSB: 0,
        bankLSB: 0,
        program: parseInt(parts[1]),
        isGMGSDrum: true
      };
    } else {
      return {
        bankLSB: parseInt(parts[0]),
        bankMSB: parseInt(parts[1]),
        program: parseInt(parts[2]),
        isGMGSDrum: false
      };
    }
  }
  static toNamedMIDIString(patch) {
    return `${_MIDIPatchTools.toMIDIString(patch)} ${patch.name}`;
  }
  static matches(patch1, patch2) {
    if (patch1.isGMGSDrum || patch2.isGMGSDrum) {
      return patch1.isGMGSDrum === patch2.isGMGSDrum && patch1.program === patch2.program;
    }
    return patch1.program === patch2.program && patch1.bankLSB === patch2.bankLSB && patch1.bankMSB === patch2.bankMSB;
  }
  static fromNamedMIDIString(string) {
    const firstSpace = string.indexOf(" ");
    if (firstSpace < 0) {
      throw new Error(`Invalid named MIDI string: ${string}`);
    }
    const patch = this.fromMIDIString(string.substring(0, firstSpace));
    const name = string.substring(firstSpace + 1);
    return {
      ...patch,
      name
    };
  }
  static sorter(a, b) {
    if (a.program !== b.program) {
      return a.program - b.program;
    }
    if (a.isGMGSDrum && !b.isGMGSDrum)
      return 1;
    if (!a.isGMGSDrum && b.isGMGSDrum)
      return -1;
    if (a.bankMSB !== b.bankMSB) {
      return a.bankMSB - b.bankMSB;
    }
    return a.bankLSB - b.bankLSB;
  }
};
var DEFAULT_COPYRIGHT = "Created using SpessaSynth";
function correctBankOffsetInternal(mid, bankOffset, soundBank) {
  let system = "gm";
  const unwantedSystems = [];
  const ports = Array(mid.tracks.length).fill(0);
  const channelsAmount = 16 + Math.max(...mid.portChannelOffsetMap);
  const channelsInfo = [];
  for (let i = 0;i < channelsAmount; i++) {
    channelsInfo.push({
      program: 0,
      drums: i % 16 === DEFAULT_PERCUSSION,
      lastBank: undefined,
      lastBankLSB: undefined,
      hasBankSelect: false
    });
  }
  mid.iterate((e, trackNum) => {
    const portOffset = mid.portChannelOffsetMap[ports[trackNum]];
    if (e.statusByte === midiMessageTypes.midiPort) {
      ports[trackNum] = e.data[0];
      return;
    }
    const status = e.statusByte & 240;
    if (status !== midiMessageTypes.controllerChange && status !== midiMessageTypes.programChange && status !== midiMessageTypes.systemExclusive) {
      return;
    }
    if (status === midiMessageTypes.systemExclusive) {
      if (!isGSDrumsOn(e)) {
        if (isXGOn(e)) {
          system = "xg";
        } else if (isGSOn(e)) {
          system = "gs";
        } else if (isGMOn(e)) {
          system = "gm";
          unwantedSystems.push({
            tNum: trackNum,
            e
          });
        } else if (isGM2On(e)) {
          system = "gm2";
        }
        return;
      }
      const sysexChannel = [9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15][e.data[5] & 15] + portOffset;
      channelsInfo[sysexChannel].drums = !!(e.data[7] > 0 && e.data[5] >> 4);
      return;
    }
    const chNum = (e.statusByte & 15) + portOffset;
    const channel = channelsInfo[chNum];
    if (status === midiMessageTypes.programChange) {
      const sentProgram = e.data[0];
      const patch = {
        program: sentProgram,
        bankLSB: channel.lastBankLSB?.data?.[1] ?? 0,
        bankMSB: BankSelectHacks.subtrackBankOffset(channel.lastBank?.data?.[1] ?? 0, mid.bankOffset),
        isGMGSDrum: channel.drums
      };
      const targetPreset = soundBank.getPreset(patch, system);
      SpessaSynthInfo(`%cInput patch: %c${MIDIPatchTools.toMIDIString(patch)}%c. Channel %c${chNum}%c. Changing patch to ${targetPreset.toString()}.`, consoleColors.info, consoleColors.unrecognized, consoleColors.info, consoleColors.recognized, consoleColors.info);
      e.data[0] = targetPreset.program;
      if (targetPreset.isGMGSDrum && BankSelectHacks.isSystemXG(system)) {
        return;
      }
      if (channel.lastBank === undefined) {
        return;
      }
      channel.lastBank.data[1] = BankSelectHacks.addBankOffset(targetPreset.bankMSB, bankOffset, targetPreset.isXGDrums);
      if (channel.lastBankLSB === undefined) {
        return;
      }
      channel.lastBankLSB.data[1] = targetPreset.bankLSB;
      return;
    }
    const isLSB = e.data[0] === midiControllers.bankSelectLSB;
    if (e.data[0] !== midiControllers.bankSelect && !isLSB) {
      return;
    }
    channel.hasBankSelect = true;
    if (isLSB) {
      channel.lastBankLSB = e;
    } else {
      channel.lastBank = e;
    }
  });
  channelsInfo.forEach((has, ch) => {
    if (has.hasBankSelect) {
      return;
    }
    const midiChannel = ch % 16;
    const status = midiMessageTypes.programChange | midiChannel;
    const portOffset = Math.floor(ch / 16) * 16;
    const port = mid.portChannelOffsetMap.indexOf(portOffset);
    const track = mid.tracks.find((t) => t.port === port && t.channels.has(midiChannel));
    if (track === undefined) {
      return;
    }
    let indexToAdd = track.events.findIndex((e) => e.statusByte === status);
    if (indexToAdd === -1) {
      const programIndex = track.events.findIndex((e) => e.statusByte > 128 && e.statusByte < 240 && (e.statusByte & 15) === midiChannel);
      if (programIndex === -1) {
        return;
      }
      const programTicks = track.events[programIndex].ticks;
      const targetProgram = soundBank.getPreset({
        bankMSB: 0,
        bankLSB: 0,
        program: 0,
        isGMGSDrum: false
      }, system).program;
      track.addEvent(new MIDIMessage(programTicks, midiMessageTypes.programChange | midiChannel, new IndexedByteArray([targetProgram])), programIndex);
      indexToAdd = programIndex;
    }
    SpessaSynthInfo(`%cAdding bank select for %c${ch}`, consoleColors.info, consoleColors.recognized);
    const ticks = track.events[indexToAdd].ticks;
    const targetPreset = soundBank.getPreset({
      bankLSB: 0,
      bankMSB: 0,
      program: has.program,
      isGMGSDrum: has.drums
    }, system);
    const targetBank = BankSelectHacks.addBankOffset(targetPreset.bankMSB, bankOffset, targetPreset.isXGDrums);
    track.addEvent(new MIDIMessage(ticks, midiMessageTypes.controllerChange | midiChannel, new IndexedByteArray([midiControllers.bankSelect, targetBank])), indexToAdd);
  });
  if (system === "gm" && !BankSelectHacks.isSystemXG(system)) {
    for (const m of unwantedSystems) {
      const track = mid.tracks[m.tNum];
      track.deleteEvent(track.events.indexOf(m.e));
    }
    let index = 0;
    if (mid.tracks[0].events[0].statusByte === midiMessageTypes.trackName) {
      index++;
    }
    mid.tracks[0].addEvent(getGsOn(0), index);
  }
}
var DEFAULT_RMIDI_WRITE_OPTIONS = {
  bankOffset: 0,
  metadata: {},
  correctBankOffset: true,
  soundBank: undefined
};
function writeRMIDIInternal(mid, soundBankBinary, options) {
  const metadata = options.metadata;
  SpessaSynthGroup("%cWriting the RMIDI File...", consoleColors.info);
  SpessaSynthInfo("metadata", metadata);
  SpessaSynthInfo("Initial bank offset", mid.bankOffset);
  if (options.correctBankOffset) {
    if (!options.soundBank) {
      throw new Error("Sound bank must be provided if correcting bank offset.");
    }
    correctBankOffsetInternal(mid, options.bankOffset, options.soundBank);
  }
  const newMid = new IndexedByteArray(mid.writeMIDI());
  metadata.name ??= mid.getName();
  metadata.creationDate ??= /* @__PURE__ */ new Date;
  metadata.copyright ??= DEFAULT_COPYRIGHT;
  metadata.software ??= "SpessaSynth";
  Object.entries(metadata).forEach((v) => {
    const val = v;
    if (val[1]) {
      mid.setRMIDInfo(val[0], val[1]);
    }
  });
  const infoContent = [];
  Object.entries(mid.rmidiInfo).forEach((v) => {
    const type = v[0];
    const data = v[1];
    const writeInfo = (type2) => {
      infoContent.push(writeRIFFChunkRaw(type2, data));
    };
    switch (type) {
      case "album":
        writeInfo("IALB");
        writeInfo("IPRD");
        break;
      case "software":
        writeInfo("ISFT");
        break;
      case "infoEncoding":
        writeInfo("IENC");
        break;
      case "creationDate":
        writeInfo("ICRD");
        break;
      case "picture":
        writeInfo("IPIC");
        break;
      case "name":
        writeInfo("INAM");
        break;
      case "artist":
        writeInfo("IART");
        break;
      case "genre":
        writeInfo("IGNR");
        break;
      case "copyright":
        writeInfo("ICOP");
        break;
      case "comment":
        writeInfo("ICMT");
        break;
      case "engineer":
        writeInfo("IENG");
        break;
      case "subject":
        writeInfo("ISBJ");
        break;
      case "midiEncoding":
        writeInfo("MENC");
        break;
    }
  });
  const DBNK = new IndexedByteArray(2);
  writeLittleEndianIndexed(DBNK, options.bankOffset, 2);
  infoContent.push(writeRIFFChunkRaw("DBNK", DBNK));
  SpessaSynthInfo("%cFinished!", consoleColors.info);
  SpessaSynthGroupEnd();
  return writeRIFFChunkParts("RIFF", [
    getStringBytes("RMID"),
    writeRIFFChunkRaw("data", newMid),
    writeRIFFChunkParts("INFO", infoContent, true),
    new IndexedByteArray(soundBankBinary)
  ]).buffer;
}
function getUsedProgramsAndKeys(mid, soundBank) {
  SpessaSynthGroupCollapsed("%cSearching for all used programs and keys...", consoleColors.info);
  const channelsAmount = 16 + Math.max(...mid.portChannelOffsetMap);
  const channelPresets = [];
  let system = "gs";
  for (let i = 0;i < channelsAmount; i++) {
    const isDrum = i % 16 === DEFAULT_PERCUSSION;
    channelPresets.push({
      preset: soundBank.getPreset({
        bankLSB: 0,
        bankMSB: 0,
        isGMGSDrum: isDrum,
        program: 0
      }, system),
      bankMSB: 0,
      bankLSB: 0,
      isDrum
    });
  }
  const usedProgramsAndKeys = /* @__PURE__ */ new Map;
  const ports = mid.tracks.map((t) => t.port);
  mid.iterate((event, trackNum) => {
    if (event.statusByte === midiMessageTypes.midiPort) {
      ports[trackNum] = event.data[0];
      return;
    }
    const status = event.statusByte & 240;
    if (status !== midiMessageTypes.noteOn && status !== midiMessageTypes.controllerChange && status !== midiMessageTypes.programChange && status !== midiMessageTypes.systemExclusive) {
      return;
    }
    const channel = (event.statusByte & 15) + mid.portChannelOffsetMap[ports[trackNum]] || 0;
    let ch = channelPresets[channel];
    switch (status) {
      case midiMessageTypes.programChange:
        ch.preset = soundBank.getPreset({
          bankMSB: ch.bankMSB,
          bankLSB: ch.bankLSB,
          program: event.data[0],
          isGMGSDrum: ch.isDrum
        }, system);
        break;
      case midiMessageTypes.controllerChange:
        {
          switch (event.data[0]) {
            default:
              return;
            case midiControllers.bankSelectLSB:
              ch.bankLSB = event.data[1];
              break;
            case midiControllers.bankSelect:
              ch.bankMSB = event.data[1];
          }
        }
        break;
      case midiMessageTypes.noteOn:
        if (event.data[1] === 0) {
          return;
        }
        let combos = usedProgramsAndKeys.get(ch.preset);
        if (!combos) {
          combos = /* @__PURE__ */ new Set;
          usedProgramsAndKeys.set(ch.preset, combos);
        }
        combos.add(`${event.data[0]}-${event.data[1]}`);
        break;
      case midiMessageTypes.systemExclusive:
        {
          if (!isGSDrumsOn(event)) {
            if (isXGOn(event)) {
              system = "xg";
              SpessaSynthInfo("%cXG on detected!", consoleColors.recognized);
            } else if (isGM2On(event)) {
              system = "gm2";
              SpessaSynthInfo("%cGM2 on detected!", consoleColors.recognized);
            } else if (isGMOn(event)) {
              system = "gm";
              SpessaSynthInfo("%cGM on detected!", consoleColors.recognized);
            } else if (isGSOn(event)) {
              system = "gs";
              SpessaSynthInfo("%cGS on detected!", consoleColors.recognized);
            }
            return;
          }
          const sysexChannel = [9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15][event.data[5] & 15] + mid.portChannelOffsetMap[ports[trackNum]];
          const isDrum = !!(event.data[7] > 0 && event.data[5] >> 4);
          ch = channelPresets[sysexChannel];
          ch.isDrum = isDrum;
        }
        break;
    }
  });
  usedProgramsAndKeys.forEach((combos, preset) => {
    if (combos.size === 0) {
      SpessaSynthInfo(`%cDetected change but no keys for %c${preset.name}`, consoleColors.info, consoleColors.value);
      usedProgramsAndKeys.delete(preset);
    }
  });
  SpessaSynthGroupEnd();
  return usedProgramsAndKeys;
}
function getNoteTimesInternal(midi, minDrumLength = 0) {
  const getTempo = (event) => {
    event.data = new IndexedByteArray(event.data.buffer);
    return 60000000 / readBigEndian(event.data, 3);
  };
  const noteTimes = [];
  const trackData = midi.tracks.map((t) => t.events);
  const events = trackData.flat();
  events.sort((e1, e2) => e1.ticks - e2.ticks);
  for (let i = 0;i < 16; i++) {
    noteTimes.push([]);
  }
  let elapsedTime = 0;
  let oneTickToSeconds = 60 / (120 * midi.timeDivision);
  let eventIndex = 0;
  let unfinished = 0;
  const unfinishedNotes = [];
  for (let i = 0;i < 16; i++) {
    unfinishedNotes.push([]);
  }
  const noteOff2 = (midiNote, channel) => {
    const noteIndex = unfinishedNotes[channel].findIndex((n) => n.midiNote === midiNote);
    const note = unfinishedNotes[channel][noteIndex];
    if (note) {
      const time = elapsedTime - note.start;
      note.length = time;
      if (channel === DEFAULT_PERCUSSION) {
        note.length = time < minDrumLength ? minDrumLength : time;
      }
      unfinishedNotes[channel].splice(noteIndex, 1);
    }
    unfinished--;
  };
  while (eventIndex < events.length) {
    const event = events[eventIndex];
    const status = event.statusByte >> 4;
    const channel = event.statusByte & 15;
    if (status === 8) {
      noteOff2(event.data[0], channel);
    } else if (status === 9) {
      if (event.data[1] === 0) {
        noteOff2(event.data[0], channel);
      } else {
        noteOff2(event.data[0], channel);
        const noteTime = {
          midiNote: event.data[0],
          start: elapsedTime,
          length: -1,
          velocity: event.data[1] / 127
        };
        noteTimes[channel].push(noteTime);
        unfinishedNotes[channel].push(noteTime);
        unfinished++;
      }
    } else if (event.statusByte === 81) {
      oneTickToSeconds = 60 / (getTempo(event) * midi.timeDivision);
    }
    if (++eventIndex >= events.length) {
      break;
    }
    elapsedTime += oneTickToSeconds * (events[eventIndex].ticks - event.ticks);
  }
  if (unfinished > 0) {
    unfinishedNotes.forEach((channelNotes, channel) => {
      channelNotes.forEach((note) => {
        const time = elapsedTime - note.start;
        note.length = time;
        if (channel === DEFAULT_PERCUSSION) {
          note.length = time < minDrumLength ? minDrumLength : time;
        }
      });
    });
  }
  return noteTimes;
}
var interpolationTypes = {
  linear: 0,
  nearestNeighbor: 1,
  hermite: 2
};
var dataEntryStates = {
  Idle: 0,
  RPCoarse: 1,
  RPFine: 2,
  NRPCoarse: 3,
  NRPFine: 4,
  DataCoarse: 5,
  DataFine: 6
};
var customControllers = {
  channelTuning: 0,
  channelTransposeFine: 1,
  modulationMultiplier: 2,
  masterTuning: 3,
  channelTuningSemitones: 4,
  channelKeyShift: 5,
  sf2NPRNGeneratorLSB: 6
};
function getControllerChange(channel, cc, value, ticks) {
  return new MIDIMessage(ticks, midiMessageTypes.controllerChange | channel % 16, new IndexedByteArray([cc, value]));
}
function getDrumChange(channel, ticks) {
  const chanAddress = 16 | [1, 2, 3, 4, 5, 6, 7, 8, 0, 9, 10, 11, 12, 13, 14, 15][channel % 16];
  const sysexData = [
    65,
    16,
    66,
    18,
    64,
    chanAddress,
    21,
    1
  ];
  const sum = 64 + chanAddress + 21 + 1;
  const checksum = 128 - sum % 128;
  return new MIDIMessage(ticks, midiMessageTypes.systemExclusive, new IndexedByteArray([...sysexData, checksum, 247]));
}
function modifyMIDIInternal(midi, desiredProgramChanges = [], desiredControllerChanges = [], desiredChannelsToClear = [], desiredChannelsToTranspose = []) {
  SpessaSynthGroupCollapsed("%cApplying changes to the MIDI file...", consoleColors.info);
  SpessaSynthInfo("Desired program changes:", desiredProgramChanges);
  SpessaSynthInfo("Desired CC changes:", desiredControllerChanges);
  SpessaSynthInfo("Desired channels to clear:", desiredChannelsToClear);
  SpessaSynthInfo("Desired channels to transpose:", desiredChannelsToTranspose);
  const channelsToChangeProgram = /* @__PURE__ */ new Set;
  desiredProgramChanges.forEach((c) => {
    channelsToChangeProgram.add(c.channel);
  });
  let system = "gs";
  let addedGs = false;
  const midiPorts = midi.tracks.map((t) => t.port);
  const midiPortChannelOffsets = {};
  let midiPortChannelOffset = 0;
  const assignMIDIPort = (trackNum, port) => {
    if (midi.tracks[trackNum].channels.size === 0) {
      return;
    }
    if (midiPortChannelOffset === 0) {
      midiPortChannelOffset += 16;
      midiPortChannelOffsets[port] = 0;
    }
    if (midiPortChannelOffsets[port] === undefined) {
      midiPortChannelOffsets[port] = midiPortChannelOffset;
      midiPortChannelOffset += 16;
    }
    midiPorts[trackNum] = port;
  };
  midi.tracks.forEach((track, i) => {
    assignMIDIPort(i, track.port);
  });
  const channelsAmount = midiPortChannelOffset;
  const isFirstNoteOn = Array(channelsAmount).fill(true);
  const coarseTranspose = Array(channelsAmount).fill(0);
  const fineTranspose = Array(channelsAmount).fill(0);
  desiredChannelsToTranspose.forEach((transpose) => {
    const coarse = Math.trunc(transpose.keyShift);
    const fine = transpose.keyShift - coarse;
    coarseTranspose[transpose.channel] = coarse;
    fineTranspose[transpose.channel] = fine;
  });
  midi.iterate((e, trackNum, eventIndexes) => {
    const track = midi.tracks[trackNum];
    const index = eventIndexes[trackNum];
    const deleteThisEvent = () => {
      track.deleteEvent(index);
      eventIndexes[trackNum]--;
    };
    const addEventBefore = (e2, offset = 0) => {
      track.addEvent(e2, index + offset);
      eventIndexes[trackNum]++;
    };
    const portOffset = midiPortChannelOffsets[midiPorts[trackNum]] || 0;
    if (e.statusByte === midiMessageTypes.midiPort) {
      assignMIDIPort(trackNum, e.data[0]);
      return;
    }
    if (e.statusByte <= midiMessageTypes.sequenceSpecific && e.statusByte >= midiMessageTypes.sequenceNumber) {
      return;
    }
    const status = e.statusByte & 240;
    const midiChannel = e.statusByte & 15;
    const channel = midiChannel + portOffset;
    if (desiredChannelsToClear.includes(channel)) {
      deleteThisEvent();
      return;
    }
    switch (status) {
      case midiMessageTypes.noteOn:
        if (isFirstNoteOn[channel]) {
          isFirstNoteOn[channel] = false;
          desiredControllerChanges.filter((c) => c.channel === channel).forEach((change) => {
            const ccChange = getControllerChange(midiChannel, change.controllerNumber, change.controllerValue, e.ticks);
            addEventBefore(ccChange);
          });
          const fineTune = fineTranspose[channel];
          if (fineTune !== 0) {
            const centsCoarse = fineTune * 64 + 64;
            const rpnCoarse = getControllerChange(midiChannel, midiControllers.registeredParameterMSB, 0, e.ticks);
            const rpnFine = getControllerChange(midiChannel, midiControllers.registeredParameterLSB, 1, e.ticks);
            const dataEntryCoarse2 = getControllerChange(channel, midiControllers.dataEntryMSB, centsCoarse, e.ticks);
            const dataEntryFine2 = getControllerChange(midiChannel, midiControllers.dataEntryLSB, 0, e.ticks);
            addEventBefore(dataEntryFine2);
            addEventBefore(dataEntryCoarse2);
            addEventBefore(rpnFine);
            addEventBefore(rpnCoarse);
          }
          if (channelsToChangeProgram.has(channel)) {
            const change = desiredProgramChanges.find((c) => c.channel === channel);
            if (!change) {
              return;
            }
            SpessaSynthInfo(`%cSetting %c${change.channel}%c to %c${MIDIPatchTools.toMIDIString(change)}%c. Track num: %c${trackNum}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
            let desiredBankMSB = change.bankMSB;
            let desiredBankLSB = change.bankLSB;
            const desiredProgram = change.program;
            const programChange2 = new MIDIMessage(e.ticks, midiMessageTypes.programChange | midiChannel, new IndexedByteArray([desiredProgram]));
            addEventBefore(programChange2);
            const addBank = (isLSB, v) => {
              const bankChange = getControllerChange(midiChannel, isLSB ? midiControllers.bankSelectLSB : midiControllers.bankSelect, v, e.ticks);
              addEventBefore(bankChange);
            };
            if (BankSelectHacks.isSystemXG(system) && change.isGMGSDrum) {
              SpessaSynthInfo(`%cAdding XG Drum change on track %c${trackNum}`, consoleColors.recognized, consoleColors.value);
              desiredBankMSB = BankSelectHacks.getDrumBank(system);
              desiredBankLSB = 0;
            }
            addBank(false, desiredBankMSB);
            addBank(true, desiredBankLSB);
            if (change.isGMGSDrum && !BankSelectHacks.isSystemXG(system) && midiChannel !== DEFAULT_PERCUSSION) {
              SpessaSynthInfo(`%cAdding GS Drum change on track %c${trackNum}`, consoleColors.recognized, consoleColors.value);
              addEventBefore(getDrumChange(midiChannel, e.ticks));
            }
          }
        }
        e.data[0] += coarseTranspose[channel];
        break;
      case midiMessageTypes.noteOff:
        e.data[0] += coarseTranspose[channel];
        break;
      case midiMessageTypes.programChange:
        if (channelsToChangeProgram.has(channel)) {
          deleteThisEvent();
          return;
        }
        break;
      case midiMessageTypes.controllerChange:
        {
          const ccNum = e.data[0];
          const changes = desiredControllerChanges.find((c) => c.channel === channel && ccNum === c.controllerNumber);
          if (changes !== undefined) {
            deleteThisEvent();
            return;
          }
          if (ccNum === midiControllers.bankSelect || ccNum === midiControllers.bankSelectLSB) {
            if (channelsToChangeProgram.has(channel)) {
              deleteThisEvent();
            }
          }
        }
        break;
      case midiMessageTypes.systemExclusive:
        if (isXGOn(e)) {
          SpessaSynthInfo("%cXG system on detected", consoleColors.info);
          system = "xg";
          addedGs = true;
        } else if (e.data[0] === 67 && e.data[2] === 76 && e.data[3] === 8 && e.data[5] === 3) {
          if (channelsToChangeProgram.has(e.data[4] + portOffset)) {
            deleteThisEvent();
          }
        } else if (isGM2On(e)) {
          SpessaSynthInfo("%cGM2 system on detected", consoleColors.info);
          system = "gm2";
          addedGs = true;
        } else if (isGSOn(e)) {
          addedGs = true;
          SpessaSynthInfo("%cGS on detected!", consoleColors.recognized);
          break;
        } else if (isGMOn(e)) {
          SpessaSynthInfo("%cGM on detected, removing!", consoleColors.info);
          deleteThisEvent();
          addedGs = false;
        }
    }
  });
  if (!addedGs && desiredProgramChanges.length > 0) {
    let index = 0;
    if (midi.tracks[0].events[0].statusByte === midiMessageTypes.trackName) {
      index++;
    }
    midi.tracks[0].addEvent(getGsOn(0), index);
    SpessaSynthInfo("%cGS on not detected. Adding it.", consoleColors.info);
  }
  midi.flush();
  SpessaSynthGroupEnd();
}
function applySnapshotInternal(midi, snapshot) {
  const channelsToTranspose = [];
  const channelsToClear = [];
  const programChanges = [];
  const controllerChanges = [];
  snapshot.channelSnapshots.forEach((channel, channelNumber) => {
    if (channel.isMuted) {
      channelsToClear.push(channelNumber);
      return;
    }
    const transposeFloat = channel.channelTransposeKeyShift + channel.customControllers[customControllers.channelTransposeFine] / 100;
    if (transposeFloat !== 0) {
      channelsToTranspose.push({
        channel: channelNumber,
        keyShift: transposeFloat
      });
    }
    if (channel.lockPreset) {
      programChanges.push({
        channel: channelNumber,
        ...channel.patch
      });
    }
    channel.lockedControllers.forEach((l, ccNumber) => {
      if (!l || ccNumber > 127 || ccNumber === midiControllers.bankSelect) {
        return;
      }
      const targetValue = channel.midiControllers[ccNumber] >> 7;
      controllerChanges.push({
        channel: channelNumber,
        controllerNumber: ccNumber,
        controllerValue: targetValue
      });
    });
  });
  midi.modify(programChanges, controllerChanges, channelsToClear, channelsToTranspose);
}
var metadataTypes = {
  XMFFileType: 0,
  nodeName: 1,
  nodeIDNumber: 2,
  resourceFormat: 3,
  filenameOnDisk: 4,
  filenameExtensionOnDisk: 5,
  macOSFileTypeAndCreator: 6,
  mimeType: 7,
  title: 8,
  copyrightNotice: 9,
  comment: 10,
  autoStart: 11,
  preload: 12,
  contentDescription: 13,
  ID3Metadata: 14
};
var referenceTypeIds = {
  inLineResource: 1,
  inFileResource: 2,
  inFileNode: 3,
  externalFile: 4,
  externalXMF: 5,
  XMFFileURIandNodeID: 6
};
var resourceFormatIDs = {
  StandardMIDIFile: 0,
  StandardMIDIFileType1: 1,
  DLS1: 2,
  DLS2: 3,
  DLS22: 4,
  mobileDLS: 5,
  unknown: -1,
  folder: -2
};
var formatTypeIDs = {
  standard: 0,
  MMA: 1,
  registered: 2,
  nonRegistered: 3
};
var unpackerIDs = {
  none: 0,
  MMAUnpacker: 1,
  registered: 2,
  nonRegistered: 3
};
var XMFNode = class _XMFNode {
  length;
  itemCount;
  metadataLength;
  metadata = {};
  nodeData;
  innerNodes = [];
  packedContent = false;
  nodeUnpackers = [];
  resourceFormat = "unknown";
  referenceTypeID;
  constructor(binaryData) {
    const nodeStartIndex = binaryData.currentIndex;
    this.length = readVariableLengthQuantity(binaryData);
    this.itemCount = readVariableLengthQuantity(binaryData);
    const headerLength = readVariableLengthQuantity(binaryData);
    const readBytes = binaryData.currentIndex - nodeStartIndex;
    const remainingHeader = headerLength - readBytes;
    const headerData = binaryData.slice(binaryData.currentIndex, binaryData.currentIndex + remainingHeader);
    binaryData.currentIndex += remainingHeader;
    this.metadataLength = readVariableLengthQuantity(headerData);
    const metadataChunk = headerData.slice(headerData.currentIndex, headerData.currentIndex + this.metadataLength);
    headerData.currentIndex += this.metadataLength;
    let fieldSpecifier;
    let key;
    while (metadataChunk.currentIndex < metadataChunk.length) {
      const firstSpecifierByte = metadataChunk[metadataChunk.currentIndex];
      if (firstSpecifierByte === 0) {
        metadataChunk.currentIndex++;
        fieldSpecifier = readVariableLengthQuantity(metadataChunk);
        if (!Object.values(metadataTypes).includes(fieldSpecifier)) {
          SpessaSynthInfo(`Unknown field specifier: ${fieldSpecifier}`);
          key = `unknown_${fieldSpecifier}`;
        } else {
          key = Object.keys(metadataTypes).find((k) => metadataTypes[k] === fieldSpecifier) ?? "";
        }
      } else {
        const stringLength = readVariableLengthQuantity(metadataChunk);
        fieldSpecifier = readBinaryStringIndexed(metadataChunk, stringLength);
        key = fieldSpecifier;
      }
      const numberOfVersions = readVariableLengthQuantity(metadataChunk);
      if (numberOfVersions === 0) {
        const dataLength = readVariableLengthQuantity(metadataChunk);
        const contentsChunk = metadataChunk.slice(metadataChunk.currentIndex, metadataChunk.currentIndex + dataLength);
        metadataChunk.currentIndex += dataLength;
        const formatID = readVariableLengthQuantity(contentsChunk);
        if (formatID < 4) {
          this.metadata[key] = readBinaryStringIndexed(contentsChunk, dataLength - 1);
        } else {
          this.metadata[key] = contentsChunk.slice(contentsChunk.currentIndex);
        }
      } else {
        SpessaSynthInfo(`International content: ${numberOfVersions}`);
        metadataChunk.currentIndex += readVariableLengthQuantity(metadataChunk);
      }
    }
    const unpackersStart = headerData.currentIndex;
    const unpackersLength = readVariableLengthQuantity(headerData);
    const unpackersData = headerData.slice(headerData.currentIndex, unpackersStart + unpackersLength);
    headerData.currentIndex = unpackersStart + unpackersLength;
    if (unpackersLength > 0) {
      this.packedContent = true;
      while (unpackersData.currentIndex < unpackersLength) {
        const unpacker = {};
        unpacker.id = readVariableLengthQuantity(unpackersData);
        switch (unpacker.id) {
          case unpackerIDs.nonRegistered:
          case unpackerIDs.registered:
            SpessaSynthGroupEnd();
            throw new Error(`Unsupported unpacker ID: ${unpacker.id}`);
          default:
            SpessaSynthGroupEnd();
            throw new Error(`Unknown unpacker ID: ${unpacker.id}`);
          case unpackerIDs.none:
            unpacker.standardID = readVariableLengthQuantity(unpackersData);
            break;
          case unpackerIDs.MMAUnpacker:
            {
              let manufacturerID = unpackersData[unpackersData.currentIndex++];
              if (manufacturerID === 0) {
                manufacturerID <<= 8;
                manufacturerID |= unpackersData[unpackersData.currentIndex++];
                manufacturerID <<= 8;
                manufacturerID |= unpackersData[unpackersData.currentIndex++];
              }
              const manufacturerInternalID = readVariableLengthQuantity(unpackersData);
              unpacker.manufacturerID = manufacturerID;
              unpacker.manufacturerInternalID = manufacturerInternalID;
            }
            break;
        }
        unpacker.decodedSize = readVariableLengthQuantity(unpackersData);
        this.nodeUnpackers.push(unpacker);
      }
    }
    binaryData.currentIndex = nodeStartIndex + headerLength;
    this.referenceTypeID = readVariableLengthQuantity(binaryData);
    this.nodeData = binaryData.slice(binaryData.currentIndex, nodeStartIndex + this.length);
    binaryData.currentIndex = nodeStartIndex + this.length;
    switch (this.referenceTypeID) {
      case referenceTypeIds.inLineResource:
        break;
      case referenceTypeIds.externalXMF:
      case referenceTypeIds.inFileNode:
      case referenceTypeIds.XMFFileURIandNodeID:
      case referenceTypeIds.externalFile:
      case referenceTypeIds.inFileResource:
        SpessaSynthGroupEnd();
        throw new Error(`Unsupported reference type: ${this.referenceTypeID}`);
      default:
        SpessaSynthGroupEnd();
        throw new Error(`Unknown reference type: ${this.referenceTypeID}`);
    }
    if (this.isFile) {
      if (this.packedContent) {
        const compressed = this.nodeData.slice(2, this.nodeData.length);
        SpessaSynthInfo(`%cPacked content. Attempting to deflate. Target size: %c${this.nodeUnpackers[0].decodedSize}`, consoleColors.warn, consoleColors.value);
        try {
          this.nodeData = new IndexedByteArray(inf(compressed).buffer);
        } catch (e) {
          SpessaSynthGroupEnd();
          if (e instanceof Error) {
            throw new Error(`Error unpacking XMF file contents: ${e.message}.`);
          }
        }
      }
      const resourceFormat = this.metadata.resourceFormat;
      if (resourceFormat === undefined) {
        SpessaSynthWarn("No resource format for this file node!");
      } else {
        const formatTypeID = resourceFormat[0];
        if (formatTypeID !== formatTypeIDs.standard) {
          SpessaSynthInfo(`Non-standard formatTypeID: ${resourceFormat.toString()}`);
          this.resourceFormat = resourceFormat.toString();
        }
        const resourceFormatID = resourceFormat[1];
        if (!Object.values(resourceFormatIDs).includes(resourceFormatID)) {
          SpessaSynthInfo(`Unrecognized resource format: ${resourceFormatID}`);
        } else {
          this.resourceFormat = Object.keys(resourceFormatIDs).find((k) => resourceFormatIDs[k] === resourceFormatID);
        }
      }
    } else {
      this.resourceFormat = "folder";
      while (this.nodeData.currentIndex < this.nodeData.length) {
        const nodeStartIndex2 = this.nodeData.currentIndex;
        const nodeLength = readVariableLengthQuantity(this.nodeData);
        const nodeData = this.nodeData.slice(nodeStartIndex2, nodeStartIndex2 + nodeLength);
        this.nodeData.currentIndex = nodeStartIndex2 + nodeLength;
        this.innerNodes.push(new _XMFNode(nodeData));
      }
    }
  }
  get isFile() {
    return this.itemCount === 0;
  }
};
function loadXMF(midi, binaryData) {
  midi.bankOffset = 0;
  const sanityCheck = readBinaryStringIndexed(binaryData, 4);
  if (sanityCheck !== "XMF_") {
    SpessaSynthGroupEnd();
    throw new SyntaxError(`Invalid XMF Header! Expected "_XMF", got "${sanityCheck}"`);
  }
  SpessaSynthGroup("%cParsing XMF file...", consoleColors.info);
  const version = readBinaryStringIndexed(binaryData, 4);
  SpessaSynthInfo(`%cXMF version: %c${version}`, consoleColors.info, consoleColors.recognized);
  if (version === "2.00") {
    const fileTypeId = readBigEndianIndexed(binaryData, 4);
    const fileTypeRevisionId = readBigEndianIndexed(binaryData, 4);
    SpessaSynthInfo(`%cFile Type ID: %c${fileTypeId}%c, File Type Revision ID: %c${fileTypeRevisionId}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
  }
  readVariableLengthQuantity(binaryData);
  const metadataTableLength = readVariableLengthQuantity(binaryData);
  binaryData.currentIndex += metadataTableLength;
  binaryData.currentIndex = readVariableLengthQuantity(binaryData);
  const rootNode = new XMFNode(binaryData);
  let midiArray = undefined;
  const searchNode = (node) => {
    const checkMeta = (xmf, rmid) => {
      if (node.metadata[xmf] !== undefined && typeof node.metadata[xmf] === "string") {
        midi.rmidiInfo[rmid] = getStringBytes(node.metadata[xmf]);
      }
    };
    checkMeta("nodeName", "name");
    checkMeta("title", "name");
    checkMeta("copyrightNotice", "copyright");
    checkMeta("comment", "comment");
    if (node.isFile) {
      switch (node.resourceFormat) {
        default:
          return;
        case "DLS1":
        case "DLS2":
        case "DLS22":
        case "mobileDLS":
          SpessaSynthInfo("%cFound embedded DLS!", consoleColors.recognized);
          midi.embeddedSoundBank = node.nodeData.buffer;
          break;
        case "StandardMIDIFile":
        case "StandardMIDIFileType1":
          SpessaSynthInfo("%cFound embedded MIDI!", consoleColors.recognized);
          midiArray = node.nodeData;
          break;
      }
    } else {
      for (const n of node.innerNodes) {
        searchNode(n);
      }
    }
  };
  searchNode(rootNode);
  SpessaSynthGroupEnd();
  if (!midiArray) {
    throw new Error("No MIDI data in the XMF file!");
  }
  return midiArray;
}
var MIDITrack = class _MIDITrack {
  name = "";
  port = 0;
  channels = /* @__PURE__ */ new Set;
  events = [];
  static copyFrom(track) {
    const t = new _MIDITrack;
    t.copyFrom(track);
    return t;
  }
  copyFrom(track) {
    this.name = track.name;
    this.port = track.port;
    this.channels = new Set(track.channels);
    this.events = track.events.map((e) => new MIDIMessage(e.ticks, e.statusByte, new IndexedByteArray(e.data)));
  }
  addEvent(event, index) {
    this.events.splice(index, 0, event);
  }
  deleteEvent(index) {
    this.events.splice(index, 1);
  }
  pushEvent(event) {
    this.events.push(event);
  }
};
function loadMIDIFromArrayBufferInternal(outputMIDI, arrayBuffer, fileName) {
  SpessaSynthGroupCollapsed(`%cParsing MIDI File...`, consoleColors.info);
  outputMIDI.fileName = fileName;
  const binaryData = new IndexedByteArray(arrayBuffer);
  let smfFileBinary = binaryData;
  const readMIDIChunk = (fileByteArray) => {
    const type = readBinaryStringIndexed(fileByteArray, 4);
    const size = readBigEndianIndexed(fileByteArray, 4);
    const data = new IndexedByteArray(size);
    const chunk = {
      type,
      size,
      data
    };
    const dataSlice = fileByteArray.slice(fileByteArray.currentIndex, fileByteArray.currentIndex + chunk.size);
    chunk.data.set(dataSlice, 0);
    fileByteArray.currentIndex += chunk.size;
    return chunk;
  };
  const initialString = readBinaryString(binaryData, 4);
  if (initialString === "RIFF") {
    binaryData.currentIndex += 8;
    const rmid = readBinaryStringIndexed(binaryData, 4);
    if (rmid !== "RMID") {
      SpessaSynthGroupEnd();
      throw new SyntaxError(`Invalid RMIDI Header! Expected "RMID", got "${rmid}"`);
    }
    const riff = readRIFFChunk(binaryData);
    if (riff.header !== "data") {
      SpessaSynthGroupEnd();
      throw new SyntaxError(`Invalid RMIDI Chunk header! Expected "data", got "${rmid}"`);
    }
    smfFileBinary = riff.data;
    let isSF2RMIDI = false;
    let foundDbnk = false;
    while (binaryData.currentIndex <= binaryData.length) {
      const startIndex = binaryData.currentIndex;
      const currentChunk = readRIFFChunk(binaryData, true);
      if (currentChunk.header === "RIFF") {
        const type = readBinaryStringIndexed(currentChunk.data, 4).toLowerCase();
        if (type === "sfbk" || type === "sfpk" || type === "dls ") {
          SpessaSynthInfo("%cFound embedded soundbank!", consoleColors.recognized);
          outputMIDI.embeddedSoundBank = binaryData.slice(startIndex, startIndex + currentChunk.size).buffer;
        } else {
          SpessaSynthWarn(`Unknown RIFF chunk: "${type}"`);
        }
        if (type === "dls ") {
          outputMIDI.isDLSRMIDI = true;
        } else {
          isSF2RMIDI = true;
        }
      } else if (currentChunk.header === "LIST") {
        const type = readBinaryStringIndexed(currentChunk.data, 4);
        if (type === "INFO") {
          SpessaSynthInfo("%cFound RMIDI INFO chunk!", consoleColors.recognized);
          while (currentChunk.data.currentIndex <= currentChunk.size) {
            const infoChunk = readRIFFChunk(currentChunk.data, true);
            const headerTyped = infoChunk.header;
            const infoData = infoChunk.data;
            switch (headerTyped) {
              default:
                SpessaSynthWarn(`Unknown RMIDI Info: ${headerTyped}`);
                break;
              case "INAM":
                outputMIDI.rmidiInfo.name = infoData;
                break;
              case "IALB":
              case "IPRD":
                outputMIDI.rmidiInfo.album = infoData;
                break;
              case "ICRT":
              case "ICRD":
                outputMIDI.rmidiInfo.creationDate = infoData;
                break;
              case "IART":
                outputMIDI.rmidiInfo.artist = infoData;
                break;
              case "IGNR":
                outputMIDI.rmidiInfo.genre = infoData;
                break;
              case "IPIC":
                outputMIDI.rmidiInfo.picture = infoData;
                break;
              case "ICOP":
                outputMIDI.rmidiInfo.copyright = infoData;
                break;
              case "ICMT":
                outputMIDI.rmidiInfo.comment = infoData;
                break;
              case "IENG":
                outputMIDI.rmidiInfo.engineer = infoData;
                break;
              case "ISFT":
                outputMIDI.rmidiInfo.software = infoData;
                break;
              case "ISBJ":
                outputMIDI.rmidiInfo.subject = infoData;
                break;
              case "IENC":
                outputMIDI.rmidiInfo.infoEncoding = infoData;
                break;
              case "MENC":
                outputMIDI.rmidiInfo.midiEncoding = infoData;
                break;
              case "DBNK":
                outputMIDI.bankOffset = readLittleEndian(infoData, 2);
                foundDbnk = true;
                break;
            }
          }
        }
      }
    }
    if (isSF2RMIDI && !foundDbnk) {
      outputMIDI.bankOffset = 1;
    }
    if (outputMIDI.isDLSRMIDI) {
      outputMIDI.bankOffset = 0;
    }
    if (outputMIDI.embeddedSoundBank === undefined) {
      outputMIDI.bankOffset = 0;
    }
  } else if (initialString === "XMF_") {
    smfFileBinary = loadXMF(outputMIDI, binaryData);
  } else {
    smfFileBinary = binaryData;
  }
  const headerChunk = readMIDIChunk(smfFileBinary);
  if (headerChunk.type !== "MThd") {
    SpessaSynthGroupEnd();
    throw new SyntaxError(`Invalid MIDI Header! Expected "MThd", got "${headerChunk.type}"`);
  }
  if (headerChunk.size !== 6) {
    SpessaSynthGroupEnd();
    throw new RangeError(`Invalid MIDI header chunk size! Expected 6, got ${headerChunk.size}`);
  }
  outputMIDI.format = readBigEndianIndexed(headerChunk.data, 2);
  const trackCount = readBigEndianIndexed(headerChunk.data, 2);
  outputMIDI.timeDivision = readBigEndianIndexed(headerChunk.data, 2);
  for (let i = 0;i < trackCount; i++) {
    const track = new MIDITrack;
    const trackChunk = readMIDIChunk(smfFileBinary);
    if (trackChunk.type !== "MTrk") {
      SpessaSynthGroupEnd();
      throw new SyntaxError(`Invalid track header! Expected "MTrk" got "${trackChunk.type}"`);
    }
    let runningByte = undefined;
    let totalTicks = 0;
    if (outputMIDI.format === 2 && i > 0) {
      totalTicks += outputMIDI.tracks[i - 1].events[outputMIDI.tracks[i - 1].events.length - 1].ticks;
    }
    while (trackChunk.data.currentIndex < trackChunk.size) {
      totalTicks += readVariableLengthQuantity(trackChunk.data);
      const statusByteCheck = trackChunk.data[trackChunk.data.currentIndex];
      let statusByte;
      if (runningByte !== undefined && statusByteCheck < 128) {
        statusByte = runningByte;
      } else {
        if (statusByteCheck < 128) {
          SpessaSynthGroupEnd();
          throw new SyntaxError(`Unexpected byte with no running byte. (${statusByteCheck})`);
        } else {
          statusByte = trackChunk.data[trackChunk.data.currentIndex++];
        }
      }
      const statusByteChannel = getChannel(statusByte);
      let eventDataLength;
      switch (statusByteChannel) {
        case -1:
          eventDataLength = 0;
          break;
        case -2:
          statusByte = trackChunk.data[trackChunk.data.currentIndex++];
          eventDataLength = readVariableLengthQuantity(trackChunk.data);
          break;
        case -3:
          eventDataLength = readVariableLengthQuantity(trackChunk.data);
          break;
        default:
          eventDataLength = dataBytesAmount[statusByte >> 4];
          runningByte = statusByte;
          break;
      }
      const eventData = new IndexedByteArray(eventDataLength);
      eventData.set(trackChunk.data.slice(trackChunk.data.currentIndex, trackChunk.data.currentIndex + eventDataLength), 0);
      const event = new MIDIMessage(totalTicks, statusByte, eventData);
      track.pushEvent(event);
      trackChunk.data.currentIndex += eventDataLength;
    }
    outputMIDI.tracks.push(track);
    SpessaSynthInfo(`%cParsed %c${outputMIDI.tracks.length}%c / %c${outputMIDI.tracks.length}`, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.value);
  }
  SpessaSynthInfo(`%cAll tracks parsed correctly!`, consoleColors.recognized);
  outputMIDI.flush(false);
  SpessaSynthGroupEnd();
}
var translationPortuguese = /* @__PURE__ */ new Map([
  ["domingo", "Sunday"],
  ["segunda-feira", "Monday"],
  ["terça-feira", "Tuesday"],
  ["quarta-feira", "Wednesday"],
  ["quinta-feira", "Thursday"],
  ["sexta-feira", "Friday"],
  ["sábado", "Saturday"],
  ["janeiro", "January"],
  ["fevereiro", "February"],
  ["março", "March"],
  ["abril", "April"],
  ["maio", "May"],
  ["junho", "June"],
  ["julho", "July"],
  ["agosto", "August"],
  ["setembro", "September"],
  ["outubro", "October"],
  ["novembro", "November"],
  ["dezembro", "December"]
]);
var translations = [translationPortuguese];
function tryTranslate(dateString) {
  for (const translation of translations) {
    let translated = dateString;
    translation.forEach((english, pt) => {
      const regex = new RegExp(pt, "gi");
      translated = translated.replace(regex, english);
    });
    const date = new Date(translated);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return;
}
function tryDotted(dateString) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateString);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return;
}
function tryAWE(dateString) {
  const match = /^(\d{1,2})\s{1,2}(\d{1,2})\s{1,2}(\d{2})$/.exec(dateString);
  if (match) {
    const day = match[1];
    const month = (parseInt(match[2]) + 1).toString();
    const year = match[3];
    const date = /* @__PURE__ */ new Date(`${month}/${day}/${year}`);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return;
}
function tryYear(dateString) {
  const regex = /\b\d{4}\b/;
  const match = regex.exec(dateString);
  return match ? new Date(match[0]) : undefined;
}
function parseDateString(dateString) {
  dateString = dateString.trim();
  if (dateString.length < 1) {
    return /* @__PURE__ */ new Date;
  }
  const filtered = dateString.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  const date = new Date(filtered);
  if (isNaN(date.getTime())) {
    const translated = tryTranslate(dateString);
    if (translated) {
      return translated;
    }
    const dotted = tryDotted(dateString);
    if (dotted) {
      return dotted;
    }
    const awe = tryAWE(dateString);
    if (awe) {
      return awe;
    }
    const year = tryYear(dateString);
    if (year) {
      return year;
    }
    SpessaSynthWarn(`Invalid date: "${dateString}". Replacing with the current date!`);
    return /* @__PURE__ */ new Date;
  }
  return date;
}
var BasicMIDI2 = class _BasicMIDI {
  tracks = [];
  timeDivision = 0;
  duration = 0;
  tempoChanges = [{ ticks: 0, tempo: 120 }];
  extraMetadata = [];
  lyrics = [];
  firstNoteOn = 0;
  keyRange = { min: 0, max: 127 };
  lastVoiceEventTick = 0;
  portChannelOffsetMap = [0];
  loop = { start: 0, end: 0, type: "hard" };
  fileName;
  format = 0;
  rmidiInfo = {};
  bankOffset = 0;
  isKaraokeFile = false;
  isMultiPort = false;
  isDLSRMIDI = false;
  embeddedSoundBank;
  binaryName;
  get infoEncoding() {
    const encodingInfo = this.rmidiInfo.infoEncoding;
    if (!encodingInfo) {
      return;
    }
    let lengthToRead = encodingInfo.byteLength;
    if (encodingInfo[encodingInfo.byteLength - 1] === 0) {
      lengthToRead--;
    }
    return readBinaryString(encodingInfo, lengthToRead);
  }
  static fromArrayBuffer(arrayBuffer, fileName = "") {
    const mid = new _BasicMIDI;
    loadMIDIFromArrayBufferInternal(mid, arrayBuffer, fileName);
    return mid;
  }
  static async fromFile(file) {
    const mid = new _BasicMIDI;
    loadMIDIFromArrayBufferInternal(mid, await file.arrayBuffer(), file.name);
    return mid;
  }
  static copyFrom(mid) {
    const m = new _BasicMIDI;
    m.copyFrom(mid);
    return m;
  }
  copyFrom(mid) {
    this.copyMetadataFrom(mid);
    this.embeddedSoundBank = mid?.embeddedSoundBank?.slice(0) ?? undefined;
    this.tracks = mid.tracks.map((track) => MIDITrack.copyFrom(track));
  }
  midiTicksToSeconds(ticks) {
    ticks = Math.max(ticks, 0);
    if (this.tempoChanges.length < 1) {
      throw new Error("There are no tempo changes in the sequence. At least one is needed.");
    }
    if (this.tempoChanges[this.tempoChanges.length - 1].ticks !== 0) {
      throw new Error(`The last tempo change is not at 0 ticks. Got ${this.tempoChanges[this.tempoChanges.length - 1].ticks} ticks.`);
    }
    let tempoIndex = this.tempoChanges.findIndex((v) => v.ticks <= ticks);
    let totalSeconds = 0;
    while (tempoIndex < this.tempoChanges.length) {
      const tempo = this.tempoChanges[tempoIndex++];
      const ticksSinceLastTempo = ticks - tempo.ticks;
      totalSeconds += ticksSinceLastTempo * 60 / (tempo.tempo * this.timeDivision);
      ticks = tempo.ticks;
    }
    return totalSeconds;
  }
  getUsedProgramsAndKeys(soundbank) {
    return getUsedProgramsAndKeys(this, soundbank);
  }
  preloadSynth(synth) {
    SpessaSynthGroupCollapsed(`%cPreloading samples...`, consoleColors.info);
    const used = this.getUsedProgramsAndKeys(synth.soundBankManager);
    used.forEach((combos, preset) => {
      SpessaSynthInfo(`%cPreloading used samples on %c${preset.name}%c...`, consoleColors.info, consoleColors.recognized, consoleColors.info);
      for (const combo of combos) {
        const [midiNote, velocity] = combo.split("-").map(Number);
        synth.getVoicesForPreset(preset, midiNote, velocity, midiNote);
      }
    });
    SpessaSynthGroupEnd();
  }
  flush(sortEvents = true) {
    if (sortEvents) {
      for (const t of this.tracks) {
        t.events.sort((e1, e2) => e1.ticks - e2.ticks);
      }
    }
    this.parseInternal();
  }
  getNoteTimes(minDrumLength = 0) {
    return getNoteTimesInternal(this, minDrumLength);
  }
  writeMIDI() {
    return writeMIDIInternal(this);
  }
  writeRMIDI(soundBankBinary, configuration = DEFAULT_RMIDI_WRITE_OPTIONS) {
    return writeRMIDIInternal(this, soundBankBinary, fillWithDefaults(configuration, DEFAULT_RMIDI_WRITE_OPTIONS));
  }
  modify(desiredProgramChanges = [], desiredControllerChanges = [], desiredChannelsToClear = [], desiredChannelsToTranspose = []) {
    modifyMIDIInternal(this, desiredProgramChanges, desiredControllerChanges, desiredChannelsToClear, desiredChannelsToTranspose);
  }
  applySnapshot(snapshot) {
    applySnapshotInternal(this, snapshot);
  }
  getName(encoding = "Shift_JIS") {
    let rawName = "";
    const n = this.getRMIDInfo("name");
    if (n) {
      return n.trim();
    }
    if (this.binaryName) {
      encoding = this.getRMIDInfo("midiEncoding") ?? encoding;
      try {
        const decoder = new TextDecoder(encoding);
        rawName = decoder.decode(this.binaryName).trim();
      } catch (e) {
        SpessaSynthWarn(`Failed to decode MIDI name: ${e}`);
      }
    }
    return rawName || this.fileName;
  }
  getExtraMetadata(encoding = "Shift_JIS") {
    encoding = this.infoEncoding ?? encoding;
    const decoder = new TextDecoder(encoding);
    return this.extraMetadata.map((d) => {
      const decoded = decoder.decode(d.data);
      return decoded.replace(/@T|@A/g, "").trim();
    });
  }
  setRMIDInfo(infoType, infoData) {
    this.rmidiInfo.infoEncoding = getStringBytes("utf-8", true);
    if (infoType === "picture") {
      this.rmidiInfo.picture = new Uint8Array(infoData);
    } else if (infoType === "creationDate") {
      this.rmidiInfo.creationDate = getStringBytes(infoData.toISOString(), true);
    } else {
      const encoded = new TextEncoder().encode(infoData);
      this.rmidiInfo[infoType] = new Uint8Array([...encoded, 0]);
    }
  }
  getRMIDInfo(infoType) {
    if (!this.rmidiInfo[infoType]) {
      return;
    }
    const encoding = this.infoEncoding ?? "UTF-8";
    if (infoType === "picture") {
      return this.rmidiInfo[infoType].buffer;
    } else if (infoType === "creationDate") {
      return parseDateString(readBinaryString(this.rmidiInfo[infoType]));
    }
    try {
      const decoder = new TextDecoder(encoding);
      let infoBuffer = this.rmidiInfo[infoType];
      if (infoBuffer[infoBuffer.length - 1] === 0) {
        infoBuffer = infoBuffer?.slice(0, infoBuffer.length - 1);
      }
      return decoder.decode(infoBuffer.buffer).trim();
    } catch (e) {
      SpessaSynthWarn(`Failed to decode ${infoType} name: ${e}`);
      return;
    }
  }
  iterate(callback) {
    const eventIndexes = Array(this.tracks.length).fill(0);
    let remainingTracks = this.tracks.length;
    const findFirstEventIndex = () => {
      let index = 0;
      let ticks = Infinity;
      this.tracks.forEach(({ events: track }, i) => {
        if (eventIndexes[i] >= track.length) {
          return;
        }
        if (track[eventIndexes[i]].ticks < ticks) {
          index = i;
          ticks = track[eventIndexes[i]].ticks;
        }
      });
      return index;
    };
    while (remainingTracks > 0) {
      const trackNum = findFirstEventIndex();
      const track = this.tracks[trackNum].events;
      if (eventIndexes[trackNum] >= track.length) {
        remainingTracks--;
        continue;
      }
      const event = track[eventIndexes[trackNum]];
      callback(event, trackNum, eventIndexes);
      eventIndexes[trackNum]++;
    }
  }
  copyMetadataFrom(mid) {
    this.fileName = mid.fileName;
    this.timeDivision = mid.timeDivision;
    this.duration = mid.duration;
    this.firstNoteOn = mid.firstNoteOn;
    this.lastVoiceEventTick = mid.lastVoiceEventTick;
    this.format = mid.format;
    this.bankOffset = mid.bankOffset;
    this.isKaraokeFile = mid.isKaraokeFile;
    this.isMultiPort = mid.isMultiPort;
    this.isDLSRMIDI = mid.isDLSRMIDI;
    this.isDLSRMIDI = mid.isDLSRMIDI;
    this.tempoChanges = [...mid.tempoChanges];
    this.extraMetadata = mid.extraMetadata.map((m) => new MIDIMessage(m.ticks, m.statusByte, new IndexedByteArray(m.data)));
    this.lyrics = mid.lyrics.map((arr) => new MIDIMessage(arr.ticks, arr.statusByte, new IndexedByteArray(arr.data)));
    this.portChannelOffsetMap = [...mid.portChannelOffsetMap];
    this.binaryName = mid?.binaryName?.slice();
    this.loop = { ...mid.loop };
    this.keyRange = { ...mid.keyRange };
    this.rmidiInfo = {};
    Object.entries(mid.rmidiInfo).forEach((v) => {
      const key = v[0];
      const value = v[1];
      this.rmidiInfo[key] = value.slice();
    });
  }
  parseInternal() {
    SpessaSynthGroup("%cInterpreting MIDI events...", consoleColors.info);
    let karaokeHasTitle = false;
    this.tempoChanges = [{ ticks: 0, tempo: 120 }];
    this.extraMetadata = [];
    this.lyrics = [];
    this.firstNoteOn = 0;
    this.keyRange = { max: 0, min: 127 };
    this.lastVoiceEventTick = 0;
    this.portChannelOffsetMap = [0];
    this.loop = { start: 0, end: 0, type: "hard" };
    this.isKaraokeFile = false;
    this.isMultiPort = false;
    let nameDetected = false;
    if (typeof this.rmidiInfo.name !== "undefined") {
      nameDetected = true;
    }
    let loopStart = null;
    let loopEnd = null;
    let loopType = "hard";
    for (const track of this.tracks) {
      const usedChannels = /* @__PURE__ */ new Set;
      let trackHasVoiceMessages = false;
      for (let i = 0;i < track.events.length; i++) {
        const e = track.events[i];
        if (e.statusByte >= 128 && e.statusByte < 240) {
          trackHasVoiceMessages = true;
          if (e.ticks > this.lastVoiceEventTick) {
            this.lastVoiceEventTick = e.ticks;
          }
          switch (e.statusByte & 240) {
            case midiMessageTypes.controllerChange:
              switch (e.data[0]) {
                case 2:
                case 111:
                case 116:
                  loopStart = e.ticks;
                  break;
                case 4:
                case 117:
                  if (loopEnd === null) {
                    loopType = "soft";
                    loopEnd = e.ticks;
                  } else {
                    loopEnd = 0;
                  }
                  break;
                case 0:
                  if (this.isDLSRMIDI && e.data[1] !== 0 && e.data[1] !== 127) {
                    SpessaSynthInfo("%cDLS RMIDI with offset 1 detected!", consoleColors.recognized);
                    this.bankOffset = 1;
                  }
              }
              break;
            case midiMessageTypes.noteOn: {
              usedChannels.add(e.statusByte & 15);
              const note = e.data[0];
              this.keyRange.min = Math.min(this.keyRange.min, note);
              this.keyRange.max = Math.max(this.keyRange.max, note);
              break;
            }
          }
        }
        const eventText = readBinaryString(e.data);
        switch (e.statusByte) {
          case midiMessageTypes.endOfTrack:
            if (i !== track.events.length - 1) {
              track.deleteEvent(i);
              i--;
              SpessaSynthWarn("Unexpected EndOfTrack. Removing!");
            }
            break;
          case midiMessageTypes.setTempo:
            this.tempoChanges.push({
              ticks: e.ticks,
              tempo: 60000000 / readBigEndian(e.data, 3)
            });
            break;
          case midiMessageTypes.marker:
            {
              const text = eventText.trim().toLowerCase();
              switch (text) {
                default:
                  break;
                case "start":
                case "loopstart":
                  loopStart = e.ticks;
                  break;
                case "loopend":
                  loopEnd = e.ticks;
              }
            }
            break;
          case midiMessageTypes.copyright:
            this.extraMetadata.push(e);
            break;
          case midiMessageTypes.lyric:
            if (eventText.trim().startsWith("@KMIDI KARAOKE FILE")) {
              this.isKaraokeFile = true;
              SpessaSynthInfo("%cKaraoke MIDI detected!", consoleColors.recognized);
            }
            if (this.isKaraokeFile) {
              e.statusByte = midiMessageTypes.text;
            } else {
              this.lyrics.push(e);
            }
          case midiMessageTypes.text: {
            const checkedText = eventText.trim();
            if (checkedText.startsWith("@KMIDI KARAOKE FILE")) {
              this.isKaraokeFile = true;
              SpessaSynthInfo("%cKaraoke MIDI detected!", consoleColors.recognized);
            } else if (this.isKaraokeFile) {
              if (checkedText.startsWith("@T") || checkedText.startsWith("@A")) {
                if (!karaokeHasTitle) {
                  this.binaryName = e.data.slice(2);
                  karaokeHasTitle = true;
                  nameDetected = true;
                } else {
                  this.extraMetadata.push(e);
                }
              } else if (!checkedText.startsWith("@")) {
                this.lyrics.push(e);
              }
            }
            break;
          }
        }
      }
      track.channels = usedChannels;
      track.name = "";
      const trackName = track.events.find((e) => e.statusByte === midiMessageTypes.trackName);
      if (trackName && this.tracks.indexOf(track) > 0) {
        track.name = readBinaryString(trackName.data);
        if (!trackHasVoiceMessages && !track.name.toLowerCase().includes("setup")) {
          this.extraMetadata.push(trackName);
        }
      }
    }
    this.tempoChanges.reverse();
    SpessaSynthInfo(`%cCorrecting loops, ports and detecting notes...`, consoleColors.info);
    const firstNoteOns = [];
    for (const t of this.tracks) {
      const firstNoteOn = t.events.find((e) => (e.statusByte & 240) === midiMessageTypes.noteOn);
      if (firstNoteOn) {
        firstNoteOns.push(firstNoteOn.ticks);
      }
    }
    this.firstNoteOn = Math.min(...firstNoteOns);
    SpessaSynthInfo(`%cFirst note-on detected at: %c${this.firstNoteOn}%c ticks!`, consoleColors.info, consoleColors.recognized, consoleColors.info);
    loopStart ??= this.firstNoteOn;
    if (loopEnd === null || loopEnd === 0) {
      loopEnd = this.lastVoiceEventTick;
    }
    this.loop = { start: loopStart, end: loopEnd, type: loopType };
    this.lastVoiceEventTick = Math.max(this.lastVoiceEventTick, this.loop.end);
    SpessaSynthInfo(`%cLoop points: start: %c${this.loop.start}%c end: %c${this.loop.end}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
    let portOffset = 0;
    this.portChannelOffsetMap = [];
    for (const track of this.tracks) {
      track.port = -1;
      if (track.channels.size === 0) {
        continue;
      }
      for (const e of track.events) {
        if (e.statusByte !== midiMessageTypes.midiPort) {
          continue;
        }
        const port = e.data[0];
        track.port = port;
        if (this.portChannelOffsetMap[port] === undefined) {
          this.portChannelOffsetMap[port] = portOffset;
          portOffset += 16;
        }
      }
    }
    this.portChannelOffsetMap = [...this.portChannelOffsetMap].map((o) => o ?? 0);
    let defaultPort = Infinity;
    for (const track of this.tracks) {
      if (track.port !== -1) {
        if (defaultPort > track.port) {
          defaultPort = track.port;
        }
      }
    }
    if (defaultPort === Infinity) {
      defaultPort = 0;
    }
    for (const track of this.tracks) {
      if (track.port === -1 || track.port === undefined) {
        track.port = defaultPort;
      }
    }
    if (this.portChannelOffsetMap.length === 0) {
      this.portChannelOffsetMap = [0];
    }
    if (this.portChannelOffsetMap.length < 2) {
      SpessaSynthInfo(`%cNo additional MIDI Ports detected.`, consoleColors.info);
    } else {
      this.isMultiPort = true;
      SpessaSynthInfo(`%cMIDI Ports detected!`, consoleColors.recognized);
    }
    if (!nameDetected) {
      if (this.tracks.length > 1) {
        if (this.tracks[0].events.find((message) => message.statusByte >= midiMessageTypes.noteOn && message.statusByte < midiMessageTypes.polyPressure) === undefined) {
          const name = this.tracks[0].events.find((message) => message.statusByte === midiMessageTypes.trackName);
          if (name) {
            this.binaryName = name.data;
          }
        }
      } else {
        const name = this.tracks[0].events.find((message) => message.statusByte === midiMessageTypes.trackName);
        if (name) {
          this.binaryName = name.data;
        }
      }
    }
    this.extraMetadata = this.extraMetadata.filter((c) => c.data.length > 0);
    this.lyrics.sort((a, b) => a.ticks - b.ticks);
    if (!this.tracks.some((t) => t.events[0].ticks === 0)) {
      const track = this.tracks[0];
      let b = this?.binaryName?.buffer;
      if (!b) {
        b = new Uint8Array(0).buffer;
      }
      track.events.unshift(new MIDIMessage(0, midiMessageTypes.trackName, new IndexedByteArray(b)));
    }
    this.duration = this.midiTicksToSeconds(this.lastVoiceEventTick);
    if (this.binaryName && this.binaryName.length < 1) {
      this.binaryName = undefined;
    }
    SpessaSynthInfo(`%cMIDI file parsed. Total tick time: %c${this.lastVoiceEventTick}%c, total seconds time: %c${formatTime(Math.ceil(this.duration)).time}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
    SpessaSynthGroupEnd();
  }
};
var DEFAULT_MIDI_BUILDER_OPTIONS = {
  name: "Untitled song",
  timeDivision: 480,
  initialTempo: 120,
  format: 0
};
var MIDIBuilder = class extends BasicMIDI2 {
  encoder = new TextEncoder;
  constructor(options = DEFAULT_MIDI_BUILDER_OPTIONS) {
    super();
    this.setRMIDInfo("midiEncoding", "utf-8");
    const fullOptions = fillWithDefaults(options, DEFAULT_MIDI_BUILDER_OPTIONS);
    if (fullOptions.format === 2) {
      throw new Error("MIDI format 2 is not supported in the MIDI builder. Consider using format 1.");
    }
    this.format = fullOptions.format;
    this.timeDivision = fullOptions.timeDivision;
    this.binaryName = this.encoder.encode(fullOptions.name);
    this.addNewTrack(fullOptions.name);
    this.addSetTempo(0, fullOptions.initialTempo);
  }
  addSetTempo(ticks, tempo) {
    const array = new IndexedByteArray(3);
    tempo = 60000000 / tempo;
    array[0] = tempo >> 16 & 255;
    array[1] = tempo >> 8 & 255;
    array[2] = tempo & 255;
    this.addEvent(ticks, 0, midiMessageTypes.setTempo, array);
  }
  addNewTrack(name, port = 0) {
    if (this.format === 0 && this.tracks.length > 0) {
      throw new Error("Can't add more tracks to MIDI format 0. Consider using format 1.");
    }
    const track = new MIDITrack;
    track.name = name;
    track.port = port;
    this.tracks.push(track);
    this.addEvent(0, this.tracks.length - 1, midiMessageTypes.trackName, this.encoder.encode(name));
    this.addEvent(0, this.tracks.length - 1, midiMessageTypes.midiPort, [
      port
    ]);
  }
  addEvent(ticks, track, event, eventData) {
    if (!this.tracks[track]) {
      throw new Error(`Track ${track} does not exist. Add it via addTrack method.`);
    }
    if (event >= midiMessageTypes.noteOff) {
      if (this.format === 1 && track === 0) {
        throw new Error("Can't add voice messages to the conductor track (0) in format 1. Consider using format 0 using a different track.");
      }
    }
    this.tracks[track].pushEvent(new MIDIMessage(ticks, event, new IndexedByteArray(eventData)));
  }
  addNoteOn(ticks, track, channel, midiNote, velocity) {
    channel %= 16;
    midiNote %= 128;
    velocity %= 128;
    this.addEvent(ticks, track, midiMessageTypes.noteOn | channel, [midiNote, velocity]);
  }
  addNoteOff(ticks, track, channel, midiNote, velocity = 64) {
    channel %= 16;
    midiNote %= 128;
    this.addEvent(ticks, track, midiMessageTypes.noteOff | channel, [midiNote, velocity]);
  }
  addProgramChange(ticks, track, channel, programNumber) {
    channel %= 16;
    programNumber %= 128;
    this.addEvent(ticks, track, midiMessageTypes.programChange | channel, [programNumber]);
  }
  addControllerChange(ticks, track, channel, controllerNumber, controllerValue) {
    channel %= 16;
    controllerNumber %= 128;
    controllerValue %= 128;
    this.addEvent(ticks, track, midiMessageTypes.controllerChange | channel, [controllerNumber, controllerValue]);
  }
  addPitchWheel(ticks, track, channel, MSB, LSB) {
    channel %= 16;
    MSB %= 128;
    LSB %= 128;
    this.addEvent(ticks, track, midiMessageTypes.pitchWheel | channel, [LSB, MSB]);
  }
};
function processEventInternal(event, trackIndex) {
  if (this.externalMIDIPlayback) {
    if (event.statusByte >= 128) {
      this.sendMIDIMessage([event.statusByte, ...event.data]);
      return;
    }
  }
  const track = this._midiData.tracks[trackIndex];
  const statusByteData = getEvent(event.statusByte);
  const offset = this.midiPortChannelOffsets[this.currentMIDIPorts[trackIndex]] || 0;
  statusByteData.channel += offset;
  switch (statusByteData.status) {
    case midiMessageTypes.noteOn: {
      const velocity = event.data[1];
      if (velocity > 0) {
        this.synth.noteOn(statusByteData.channel, event.data[0], velocity);
        this.playingNotes.push({
          midiNote: event.data[0],
          channel: statusByteData.channel,
          velocity
        });
      } else {
        this.synth.noteOff(statusByteData.channel, event.data[0]);
        const toDelete = this.playingNotes.findIndex((n) => n.midiNote === event.data[0] && n.channel === statusByteData.channel);
        if (toDelete !== -1) {
          this.playingNotes.splice(toDelete, 1);
        }
      }
      break;
    }
    case midiMessageTypes.noteOff: {
      this.synth.noteOff(statusByteData.channel, event.data[0]);
      const toDelete = this.playingNotes.findIndex((n) => n.midiNote === event.data[0] && n.channel === statusByteData.channel);
      if (toDelete !== -1) {
        this.playingNotes.splice(toDelete, 1);
      }
      break;
    }
    case midiMessageTypes.pitchWheel:
      this.synth.pitchWheel(statusByteData.channel, event.data[1] << 7 | event.data[0]);
      break;
    case midiMessageTypes.controllerChange:
      if (this._midiData.isMultiPort && track.channels.size === 0) {
        return;
      }
      this.synth.controllerChange(statusByteData.channel, event.data[0], event.data[1]);
      break;
    case midiMessageTypes.programChange:
      if (this._midiData.isMultiPort && track.channels.size === 0) {
        return;
      }
      this.synth.programChange(statusByteData.channel, event.data[0]);
      break;
    case midiMessageTypes.polyPressure:
      this.synth.polyPressure(statusByteData.channel, event.data[0], event.data[1]);
      break;
    case midiMessageTypes.channelPressure:
      this.synth.channelPressure(statusByteData.channel, event.data[0]);
      break;
    case midiMessageTypes.systemExclusive:
      this.synth.systemExclusive(event.data, offset);
      break;
    case midiMessageTypes.setTempo: {
      let tempoBPM = 60000000 / readBigEndian(event.data, 3);
      this.oneTickToSeconds = 60 / (tempoBPM * this._midiData.timeDivision);
      if (this.oneTickToSeconds === 0) {
        this.oneTickToSeconds = 60 / (120 * this._midiData.timeDivision);
        SpessaSynthInfo("invalid tempo! falling back to 120 BPM");
        tempoBPM = 120;
      }
      break;
    }
    case midiMessageTypes.timeSignature:
    case midiMessageTypes.endOfTrack:
    case midiMessageTypes.midiChannelPrefix:
    case midiMessageTypes.songPosition:
    case midiMessageTypes.activeSensing:
    case midiMessageTypes.keySignature:
    case midiMessageTypes.sequenceNumber:
    case midiMessageTypes.sequenceSpecific:
    case midiMessageTypes.text:
    case midiMessageTypes.lyric:
    case midiMessageTypes.copyright:
    case midiMessageTypes.trackName:
    case midiMessageTypes.marker:
    case midiMessageTypes.cuePoint:
    case midiMessageTypes.instrumentName:
    case midiMessageTypes.programName:
      break;
    case midiMessageTypes.midiPort:
      this.assignMIDIPort(trackIndex, event.data[0]);
      break;
    case midiMessageTypes.reset:
      this.synth.stopAllChannels();
      this.synth.resetAllControllers();
      break;
    default:
      SpessaSynthInfo(`%cUnrecognized Event: %c${event.statusByte}%c status byte: %c${Object.keys(midiMessageTypes).find((k) => midiMessageTypes[k] === statusByteData.status)}`, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn, consoleColors.value);
      break;
  }
  if (statusByteData.status >= 0 && statusByteData.status < 128) {
    this.callEvent("metaEvent", {
      event,
      trackIndex
    });
  }
}
function processTick() {
  if (this.paused || !this._midiData) {
    return;
  }
  const currentTime = this.currentTime;
  while (this.playedTime < currentTime) {
    const trackIndex = this.findFirstEventIndex();
    const track = this._midiData.tracks[trackIndex];
    const event = track.events[this.eventIndexes[trackIndex]++];
    this.processEvent(event, trackIndex);
    const nextTrackIndex = this.findFirstEventIndex();
    const nextTrack = this._midiData.tracks[nextTrackIndex];
    if (this.loopCount > 0 && this._midiData.loop.end <= event.ticks) {
      if (this.loopCount !== Infinity) {
        this.loopCount--;
        this.callEvent("loopCountChange", {
          newCount: this.loopCount
        });
      }
      if (this._midiData.loop.type === "soft") {
        this.jumpToTick(this._midiData.loop.start);
      } else {
        this.setTimeTicks(this._midiData.loop.start);
      }
      return;
    }
    if (nextTrack.events.length <= this.eventIndexes[nextTrackIndex] || event.ticks >= this._midiData.lastVoiceEventTick) {
      this.songIsFinished();
      return;
    }
    const eventNext = nextTrack.events[this.eventIndexes[nextTrackIndex]];
    this.playedTime += this.oneTickToSeconds * (eventNext.ticks - event.ticks);
  }
}
function assignMIDIPortInternal(trackNum, port) {
  if (this._midiData.tracks[trackNum].channels.size === 0) {
    return;
  }
  if (this.midiPortChannelOffset === 0) {
    this.midiPortChannelOffset += 16;
    this.midiPortChannelOffsets[port] = 0;
  }
  if (this.midiPortChannelOffsets[port] === undefined) {
    if (this.synth.midiChannels.length < this.midiPortChannelOffset + 15) {
      this.addNewMIDIPort();
    }
    this.midiPortChannelOffsets[port] = this.midiPortChannelOffset;
    this.midiPortChannelOffset += 16;
  }
  this.currentMIDIPorts[trackNum] = port;
}
function loadNewSequenceInternal(parsedMidi) {
  if (!parsedMidi.tracks) {
    throw new Error("This MIDI has no tracks!");
  }
  if (parsedMidi.duration === 0) {
    SpessaSynthWarn("This MIDI file has a duration of exactly 0 seconds.");
    this.pausedTime = 0;
    this.isFinished = true;
    return;
  }
  this.oneTickToSeconds = 60 / (120 * parsedMidi.timeDivision);
  this._midiData = parsedMidi;
  this.isFinished = false;
  this.synth.clearEmbeddedBank();
  if (this._midiData.embeddedSoundBank !== undefined) {
    SpessaSynthInfo("%cEmbedded soundbank detected! Using it.", consoleColors.recognized);
    this.synth.setEmbeddedSoundBank(this._midiData.embeddedSoundBank, this._midiData.bankOffset);
    if (this.preload) {
      this._midiData.preloadSynth(this.synth);
    }
  }
  this.currentMIDIPorts = this._midiData.tracks.map((t) => t.port);
  this.midiPortChannelOffset = 0;
  this.midiPortChannelOffsets = {};
  this._midiData.tracks.forEach((track, trackIndex) => {
    this.assignMIDIPort(trackIndex, track.port);
  });
  this.firstNoteTime = this._midiData.midiTicksToSeconds(this._midiData.firstNoteOn);
  SpessaSynthInfo(`%cTotal song time: ${formatTime(Math.ceil(this._midiData.duration)).time}`, consoleColors.recognized);
  this.callEvent("songChange", { songIndex: this._songIndex });
  if (this._midiData.duration <= 0.2) {
    SpessaSynthWarn(`%cVery short song: (${formatTime(Math.round(this._midiData.duration)).time}). Disabling loop!`, consoleColors.warn);
    this.loopCount = 0;
  }
  this.currentTime = 0;
}
var generatorTypes = {
  INVALID: -1,
  startAddrsOffset: 0,
  endAddrOffset: 1,
  startloopAddrsOffset: 2,
  endloopAddrsOffset: 3,
  startAddrsCoarseOffset: 4,
  modLfoToPitch: 5,
  vibLfoToPitch: 6,
  modEnvToPitch: 7,
  initialFilterFc: 8,
  initialFilterQ: 9,
  modLfoToFilterFc: 10,
  modEnvToFilterFc: 11,
  endAddrsCoarseOffset: 12,
  modLfoToVolume: 13,
  unused1: 14,
  chorusEffectsSend: 15,
  reverbEffectsSend: 16,
  pan: 17,
  unused2: 18,
  unused3: 19,
  unused4: 20,
  delayModLFO: 21,
  freqModLFO: 22,
  delayVibLFO: 23,
  freqVibLFO: 24,
  delayModEnv: 25,
  attackModEnv: 26,
  holdModEnv: 27,
  decayModEnv: 28,
  sustainModEnv: 29,
  releaseModEnv: 30,
  keyNumToModEnvHold: 31,
  keyNumToModEnvDecay: 32,
  delayVolEnv: 33,
  attackVolEnv: 34,
  holdVolEnv: 35,
  decayVolEnv: 36,
  sustainVolEnv: 37,
  releaseVolEnv: 38,
  keyNumToVolEnvHold: 39,
  keyNumToVolEnvDecay: 40,
  instrument: 41,
  reserved1: 42,
  keyRange: 43,
  velRange: 44,
  startloopAddrsCoarseOffset: 45,
  keyNum: 46,
  velocity: 47,
  initialAttenuation: 48,
  reserved2: 49,
  endloopAddrsCoarseOffset: 50,
  coarseTune: 51,
  fineTune: 52,
  sampleID: 53,
  sampleModes: 54,
  reserved3: 55,
  scaleTuning: 56,
  exclusiveClass: 57,
  overridingRootKey: 58,
  unused5: 59,
  endOper: 60,
  vibLfoToVolume: 61,
  vibLfoToFilterFc: 62
};
var GENERATORS_AMOUNT = Object.keys(generatorTypes).length;
var MAX_GENERATOR = Math.max(...Object.values(generatorTypes));
var generatorLimits = [];
generatorLimits[generatorTypes.startAddrsOffset] = {
  min: 0,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.endAddrOffset] = {
  min: -32768,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.startloopAddrsOffset] = {
  min: -32768,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.endloopAddrsOffset] = {
  min: -32768,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.startAddrsCoarseOffset] = {
  min: 0,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.modLfoToPitch] = {
  min: -12000,
  max: 12000,
  def: 0,
  nrpn: 2
};
generatorLimits[generatorTypes.vibLfoToPitch] = {
  min: -12000,
  max: 12000,
  def: 0,
  nrpn: 2
};
generatorLimits[generatorTypes.modEnvToPitch] = {
  min: -12000,
  max: 12000,
  def: 0,
  nrpn: 2
};
generatorLimits[generatorTypes.initialFilterFc] = {
  min: 1500,
  max: 13500,
  def: 13500,
  nrpn: 2
};
generatorLimits[generatorTypes.initialFilterQ] = {
  min: 0,
  max: 960,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.modLfoToFilterFc] = {
  min: -12000,
  max: 12000,
  def: 0,
  nrpn: 2
};
generatorLimits[generatorTypes.vibLfoToFilterFc] = {
  min: -12000,
  max: 12000,
  def: 0,
  nrpn: 2
};
generatorLimits[generatorTypes.modEnvToFilterFc] = {
  min: -12000,
  max: 12000,
  def: 0,
  nrpn: 2
};
generatorLimits[generatorTypes.endAddrsCoarseOffset] = {
  min: -32768,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.modLfoToVolume] = {
  min: -960,
  max: 960,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.vibLfoToVolume] = {
  min: -960,
  max: 960,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.chorusEffectsSend] = {
  min: 0,
  max: 1000,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.reverbEffectsSend] = {
  min: 0,
  max: 1000,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.pan] = { min: -500, max: 500, def: 0, nrpn: 1 };
generatorLimits[generatorTypes.delayModLFO] = {
  min: -12000,
  max: 5000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.freqModLFO] = {
  min: -16000,
  max: 4500,
  def: 0,
  nrpn: 4
};
generatorLimits[generatorTypes.delayVibLFO] = {
  min: -12000,
  max: 5000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.freqVibLFO] = {
  min: -16000,
  max: 4500,
  def: 0,
  nrpn: 4
};
generatorLimits[generatorTypes.delayModEnv] = {
  min: -32768,
  max: 5000,
  def: -32768,
  nrpn: 2
};
generatorLimits[generatorTypes.attackModEnv] = {
  min: -32768,
  max: 8000,
  def: -32768,
  nrpn: 2
};
generatorLimits[generatorTypes.holdModEnv] = {
  min: -12000,
  max: 5000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.decayModEnv] = {
  min: -12000,
  max: 8000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.sustainModEnv] = {
  min: 0,
  max: 1000,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.releaseModEnv] = {
  min: -12000,
  max: 8000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.keyNumToModEnvHold] = {
  min: -1200,
  max: 1200,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.keyNumToModEnvDecay] = {
  min: -1200,
  max: 1200,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.delayVolEnv] = {
  min: -12000,
  max: 5000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.attackVolEnv] = {
  min: -12000,
  max: 8000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.holdVolEnv] = {
  min: -12000,
  max: 5000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.decayVolEnv] = {
  min: -12000,
  max: 8000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.sustainVolEnv] = {
  min: 0,
  max: 1440,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.releaseVolEnv] = {
  min: -12000,
  max: 8000,
  def: -12000,
  nrpn: 2
};
generatorLimits[generatorTypes.keyNumToVolEnvHold] = {
  min: -1200,
  max: 1200,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.keyNumToVolEnvDecay] = {
  min: -1200,
  max: 1200,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.startloopAddrsCoarseOffset] = {
  min: -32768,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.keyNum] = {
  min: -1,
  max: 127,
  def: -1,
  nrpn: 1
};
generatorLimits[generatorTypes.velocity] = {
  min: -1,
  max: 127,
  def: -1,
  nrpn: 1
};
generatorLimits[generatorTypes.initialAttenuation] = {
  min: 0,
  max: 1440,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.endloopAddrsCoarseOffset] = {
  min: -32768,
  max: 32768,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.coarseTune] = {
  min: -120,
  max: 120,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.fineTune] = {
  min: -12700,
  max: 12700,
  def: 0,
  nrpn: 1
};
generatorLimits[generatorTypes.scaleTuning] = {
  min: 0,
  max: 1200,
  def: 100,
  nrpn: 1
};
generatorLimits[generatorTypes.exclusiveClass] = {
  min: 0,
  max: 99999,
  def: 0,
  nrpn: 0
};
generatorLimits[generatorTypes.overridingRootKey] = {
  min: 0 - 1,
  max: 127,
  def: -1,
  nrpn: 0
};
generatorLimits[generatorTypes.sampleModes] = {
  min: 0,
  max: 3,
  def: 0,
  nrpn: 0
};
var sampleTypes = {
  monoSample: 1,
  rightSample: 2,
  leftSample: 4,
  linkedSample: 8,
  romMonoSample: 32769,
  romRightSample: 32770,
  romLeftSample: 32772,
  romLinkedSample: 32776
};
var modulatorSources = {
  noController: 0,
  noteOnVelocity: 2,
  noteOnKeyNum: 3,
  polyPressure: 10,
  channelPressure: 13,
  pitchWheel: 14,
  pitchWheelRange: 16,
  link: 127
};
var modulatorCurveTypes = {
  linear: 0,
  concave: 1,
  convex: 2,
  switch: 3
};
var dlsSources = {
  none: 0,
  modLfo: 1,
  velocity: 2,
  keyNum: 3,
  volEnv: 4,
  modEnv: 5,
  pitchWheel: 6,
  polyPressure: 7,
  channelPressure: 8,
  vibratoLfo: 9,
  modulationWheel: 129,
  volume: 135,
  pan: 138,
  expression: 139,
  chorus: 221,
  reverb: 219,
  pitchWheelRange: 256,
  fineTune: 257,
  coarseTune: 258
};
var dlsDestinations = {
  none: 0,
  gain: 1,
  reserved: 2,
  pitch: 3,
  pan: 4,
  keyNum: 5,
  chorusSend: 128,
  reverbSend: 129,
  modLfoFreq: 260,
  modLfoDelay: 261,
  vibLfoFreq: 276,
  vibLfoDelay: 277,
  volEnvAttack: 518,
  volEnvDecay: 519,
  reservedEG1: 520,
  volEnvRelease: 521,
  volEnvSustain: 522,
  volEnvDelay: 523,
  volEnvHold: 524,
  modEnvAttack: 778,
  modEnvDecay: 779,
  reservedEG2: 780,
  modEnvRelease: 781,
  modEnvSustain: 782,
  modEnvDelay: 783,
  modEnvHold: 784,
  filterCutoff: 1280,
  filterQ: 1281
};
var DLSLoopTypes = {
  forward: 0,
  loopAndRelease: 1
};
var NON_CC_INDEX_OFFSET = 128;
var CONTROLLER_TABLE_SIZE = 147;
var defaultMIDIControllerValues = new Int16Array(CONTROLLER_TABLE_SIZE).fill(0);
var setResetValue = (i, v) => defaultMIDIControllerValues[i] = v << 7;
setResetValue(midiControllers.mainVolume, 100);
setResetValue(midiControllers.balance, 64);
setResetValue(midiControllers.expressionController, 127);
setResetValue(midiControllers.pan, 64);
setResetValue(midiControllers.portamentoOnOff, 127);
setResetValue(midiControllers.filterResonance, 64);
setResetValue(midiControllers.releaseTime, 64);
setResetValue(midiControllers.attackTime, 64);
setResetValue(midiControllers.brightness, 64);
setResetValue(midiControllers.decayTime, 64);
setResetValue(midiControllers.vibratoRate, 64);
setResetValue(midiControllers.vibratoDepth, 64);
setResetValue(midiControllers.vibratoDelay, 64);
setResetValue(midiControllers.generalPurposeController6, 64);
setResetValue(midiControllers.generalPurposeController8, 64);
setResetValue(midiControllers.registeredParameterLSB, 127);
setResetValue(midiControllers.registeredParameterMSB, 127);
setResetValue(midiControllers.nonRegisteredParameterLSB, 127);
setResetValue(midiControllers.nonRegisteredParameterMSB, 127);
setResetValue(NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel, 64);
setResetValue(NON_CC_INDEX_OFFSET + modulatorSources.pitchWheelRange, 2);
var CUSTOM_CONTROLLER_TABLE_SIZE = Object.keys(customControllers).length;
var customResetArray = new Float32Array(CUSTOM_CONTROLLER_TABLE_SIZE);
customResetArray[customControllers.modulationMultiplier] = 1;
function resetAllControllersInternal(system = DEFAULT_SYNTH_MODE) {
  this.privateProps.callEvent("allControllerReset", undefined);
  this.setMasterParameter("midiSystem", system);
  this.privateProps.tunings.length = 0;
  for (let i = 0;i < 128; i++) {
    this.privateProps.tunings.push([]);
  }
  this.setMIDIVolume(1);
  this.privateProps.reverbSend = 1;
  this.privateProps.chorusSend = 1;
  if (!this.privateProps.drumPreset || !this.privateProps.defaultPreset) {
    return;
  }
  for (let channelNumber = 0;channelNumber < this.midiChannels.length; channelNumber++) {
    const ch = this.midiChannels[channelNumber];
    ch.resetControllers(false);
    ch.resetPreset();
    for (let ccNum = 0;ccNum < 128; ccNum++) {
      if (this.midiChannels[channelNumber].lockedControllers[ccNum]) {
        this.privateProps.callEvent("controllerChange", {
          channel: channelNumber,
          controllerNumber: ccNum,
          controllerValue: this.midiChannels[channelNumber].midiControllers[ccNum] >> 7
        });
      }
    }
    if (!this.midiChannels[channelNumber].lockedControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel]) {
      const val = this.midiChannels[channelNumber].midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel];
      this.privateProps.callEvent("pitchWheel", {
        channel: channelNumber,
        pitch: val
      });
    }
    if (!this.midiChannels[channelNumber].lockedControllers[NON_CC_INDEX_OFFSET + modulatorSources.channelPressure]) {
      const val = this.midiChannels[channelNumber].midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.channelPressure] >> 7;
      this.privateProps.callEvent("channelPressure", {
        channel: channelNumber,
        pressure: val
      });
    }
  }
}
function resetPortamento(sendCC) {
  if (this.lockedControllers[midiControllers.portamentoControl])
    return;
  if (this.channelSystem === "xg") {
    this.controllerChange(midiControllers.portamentoControl, 60, sendCC);
  } else {
    this.controllerChange(midiControllers.portamentoControl, 0, sendCC);
  }
}
function resetControllers(sendCCEvents = true) {
  this.channelOctaveTuning.fill(0);
  for (let cc = 0;cc < defaultMIDIControllerValues.length; cc++) {
    if (this.lockedControllers[cc]) {
      continue;
    }
    const resetValue = defaultMIDIControllerValues[cc];
    if (this.midiControllers[cc] !== resetValue && cc < 127) {
      if (cc !== midiControllers.portamentoControl && cc !== midiControllers.dataEntryMSB && cc !== midiControllers.registeredParameterMSB && cc !== midiControllers.registeredParameterLSB && cc !== midiControllers.nonRegisteredParameterMSB && cc !== midiControllers.nonRegisteredParameterLSB) {
        this.controllerChange(cc, resetValue >> 7, sendCCEvents);
      }
    } else {
      this.midiControllers[cc] = resetValue;
    }
  }
  resetPortamento.call(this, sendCCEvents);
  this.channelVibrato = { rate: 0, depth: 0, delay: 0 };
  this.randomPan = false;
  this.sysExModulators.resetModulators();
  const transpose = this.customControllers[customControllers.channelTransposeFine];
  this.customControllers.set(customResetArray);
  this.setCustomController(customControllers.channelTransposeFine, transpose);
  this.resetParameters();
}
function resetPreset() {
  this.setBankMSB(BankSelectHacks.getDefaultBank(this.channelSystem));
  this.setBankLSB(0);
  this.setGSDrums(false);
  this.setDrums(this.channelNumber % 16 === DEFAULT_PERCUSSION);
  this.programChange(0);
}
var nonResettableCCs = /* @__PURE__ */ new Set([
  midiControllers.bankSelect,
  midiControllers.bankSelectLSB,
  midiControllers.mainVolume,
  midiControllers.mainVolumeLSB,
  midiControllers.pan,
  midiControllers.panLSB,
  midiControllers.reverbDepth,
  midiControllers.tremoloDepth,
  midiControllers.chorusDepth,
  midiControllers.detuneDepth,
  midiControllers.phaserDepth,
  midiControllers.soundVariation,
  midiControllers.filterResonance,
  midiControllers.releaseTime,
  midiControllers.attackTime,
  midiControllers.brightness,
  midiControllers.decayTime,
  midiControllers.vibratoRate,
  midiControllers.vibratoDepth,
  midiControllers.vibratoDelay,
  midiControllers.soundController10
]);
function resetControllersRP15Compliant() {
  this.channelOctaveTuning.fill(0);
  this.pitchWheel(8192);
  this.channelVibrato = { rate: 0, depth: 0, delay: 0 };
  for (let i = 0;i < 128; i++) {
    const resetValue = defaultMIDIControllerValues[i];
    if (!nonResettableCCs.has(i) && resetValue !== this.midiControllers[i]) {
      if (i !== midiControllers.portamentoControl) {
        this.controllerChange(i, resetValue >> 7);
      }
    }
  }
  resetPortamento.call(this, true);
  this.resetGeneratorOverrides();
  this.resetGeneratorOffsets();
}
function resetParameters() {
  this.dataEntryState = dataEntryStates.Idle;
  this.midiControllers[midiControllers.nonRegisteredParameterLSB] = 127 << 7;
  this.midiControllers[midiControllers.nonRegisteredParameterMSB] = 127 << 7;
  this.midiControllers[midiControllers.registeredParameterLSB] = 127 << 7;
  this.midiControllers[midiControllers.registeredParameterMSB] = 127 << 7;
  this.resetGeneratorOverrides();
  this.resetGeneratorOffsets();
}
var defaultControllerArray = defaultMIDIControllerValues.slice(0, 128);
function setTimeToInternal(time, ticks = undefined) {
  if (!this._midiData) {
    return false;
  }
  this.oneTickToSeconds = 60 / (120 * this._midiData.timeDivision);
  this.sendMIDIReset();
  this.playedTime = 0;
  this.eventIndexes = Array(this._midiData.tracks.length).fill(0);
  const channelsToSave = this.synth.midiChannels.length;
  const pitchWheels = Array(channelsToSave).fill(8192);
  const programs = [];
  for (let i = 0;i < channelsToSave; i++) {
    programs.push({
      program: -1,
      bank: 0,
      actualBank: 0
    });
  }
  const isCCNonSkippable = (cc) => cc === midiControllers.dataDecrement || cc === midiControllers.dataIncrement || cc === midiControllers.dataEntryMSB || cc === midiControllers.dataEntryLSB || cc === midiControllers.registeredParameterLSB || cc === midiControllers.registeredParameterMSB || cc === midiControllers.nonRegisteredParameterLSB || cc === midiControllers.nonRegisteredParameterMSB || cc === midiControllers.bankSelect || cc === midiControllers.bankSelectLSB || cc === midiControllers.resetAllControllers;
  const savedControllers = [];
  for (let i = 0;i < channelsToSave; i++) {
    savedControllers.push(Array.from(defaultControllerArray));
  }
  let savedTempo = undefined;
  let savedTempoTrack = 0;
  function resetAllControllers(chan) {
    pitchWheels[chan] = 8192;
    if (savedControllers?.[chan] === undefined) {
      return;
    }
    for (let i = 0;i < defaultControllerArray.length; i++) {
      if (!nonResettableCCs.has(i)) {
        savedControllers[chan][i] = defaultControllerArray[i];
      }
    }
  }
  while (true) {
    let trackIndex = this.findFirstEventIndex();
    const track = this._midiData.tracks[trackIndex];
    const event = track.events[this.eventIndexes[trackIndex]];
    if (ticks !== undefined) {
      if (event.ticks >= ticks) {
        break;
      }
    } else {
      if (this.playedTime >= time) {
        break;
      }
    }
    const info = getEvent(event.statusByte);
    const channel = info.channel + (this.midiPortChannelOffsets[track.port] || 0);
    switch (info.status) {
      case midiMessageTypes.noteOn:
        savedControllers[channel] ??= Array.from(defaultControllerArray);
        savedControllers[channel][midiControllers.portamentoControl] = event.data[0];
        break;
      case midiMessageTypes.noteOff:
        break;
      case midiMessageTypes.pitchWheel:
        pitchWheels[channel] = event.data[1] << 7 | event.data[0];
        break;
      case midiMessageTypes.programChange: {
        if (this._midiData.isMultiPort && track.channels.size === 0) {
          break;
        }
        const p = programs[channel];
        p.program = event.data[0];
        p.actualBank = p.bank;
        break;
      }
      case midiMessageTypes.controllerChange: {
        if (this._midiData.isMultiPort && track.channels.size === 0) {
          break;
        }
        const controllerNumber = event.data[0];
        if (isCCNonSkippable(controllerNumber)) {
          const ccV = event.data[1];
          if (controllerNumber === midiControllers.bankSelect) {
            programs[channel].bank = ccV;
            break;
          } else if (controllerNumber === midiControllers.resetAllControllers) {
            resetAllControllers(channel);
          }
          this.sendMIDICC(channel, controllerNumber, ccV);
        } else {
          savedControllers[channel] ??= Array.from(defaultControllerArray);
          savedControllers[channel][controllerNumber] = event.data[1];
        }
        break;
      }
      case midiMessageTypes.setTempo:
        const tempoBPM = 60000000 / readBigEndian(event.data, 3);
        this.oneTickToSeconds = 60 / (tempoBPM * this._midiData.timeDivision);
        savedTempo = event;
        savedTempoTrack = trackIndex;
        break;
      default:
        this.processEvent(event, trackIndex);
        break;
    }
    this.eventIndexes[trackIndex]++;
    trackIndex = this.findFirstEventIndex();
    const nextEvent = this._midiData.tracks[trackIndex].events[this.eventIndexes[trackIndex]];
    if (nextEvent === undefined) {
      this.stop();
      return false;
    }
    this.playedTime += this.oneTickToSeconds * (nextEvent.ticks - event.ticks);
  }
  for (let channel = 0;channel < channelsToSave; channel++) {
    if (pitchWheels[channel] !== undefined) {
      this.sendMIDIPitchWheel(channel, pitchWheels[channel]);
    }
    if (savedControllers[channel] !== undefined) {
      savedControllers[channel].forEach((value, index) => {
        if (value !== defaultControllerArray[index] && !isCCNonSkippable(index)) {
          this.sendMIDICC(channel, index, value);
        }
      });
    }
    if (programs[channel].actualBank >= 0) {
      const p = programs[channel];
      if (p.program !== -1) {
        this.sendMIDICC(channel, midiControllers.bankSelect, p.actualBank);
        this.sendMIDIProgramChange(channel, p.program);
      } else {
        this.sendMIDICC(channel, midiControllers.bankSelect, p.bank);
      }
    }
  }
  if (savedTempo) {
    this.callEvent("metaEvent", {
      event: savedTempo,
      trackIndex: savedTempoTrack
    });
  }
  if (this.paused) {
    this.pausedTime = this.playedTime;
  }
  return true;
}
var SpessaSynthSequencer = class {
  songs = [];
  shuffledSongIndexes = [];
  synth;
  externalMIDIPlayback = false;
  retriggerPausedNotes = true;
  loopCount = 0;
  skipToFirstNoteOn = true;
  isFinished = false;
  preload = true;
  onEventCall;
  processTick = processTick.bind(this);
  firstNoteTime = 0;
  oneTickToSeconds = 0;
  eventIndexes = [];
  playedTime = 0;
  pausedTime = -1;
  absoluteStartTime = 0;
  playingNotes = [];
  currentMIDIPorts = [];
  midiPortChannelOffset = 0;
  midiPortChannelOffsets = {};
  assignMIDIPort = assignMIDIPortInternal.bind(this);
  loadNewSequence = loadNewSequenceInternal.bind(this);
  processEvent = processEventInternal.bind(this);
  setTimeTo = setTimeToInternal.bind(this);
  constructor(spessasynthProcessor) {
    this.synth = spessasynthProcessor;
    this.absoluteStartTime = this.synth.currentSynthTime;
  }
  _midiData;
  get midiData() {
    return this._midiData;
  }
  get duration() {
    return this._midiData?.duration ?? 0;
  }
  _songIndex = 0;
  get songIndex() {
    return this._songIndex;
  }
  set songIndex(value) {
    this._songIndex = value;
    this._songIndex = Math.max(0, value % this.songs.length);
    this.loadCurrentSong();
  }
  _shuffleMode = false;
  get shuffleMode() {
    return this._shuffleMode;
  }
  set shuffleMode(on) {
    this._shuffleMode = on;
    if (on) {
      this.shuffleSongIndexes();
      this._songIndex = 0;
      this.loadCurrentSong();
    } else {
      this._songIndex = this.shuffledSongIndexes[this._songIndex];
    }
  }
  _playbackRate = 1;
  get playbackRate() {
    return this._playbackRate;
  }
  set playbackRate(value) {
    const t = this.currentTime;
    this._playbackRate = value;
    this.recalculateStartTime(t);
  }
  get currentTime() {
    if (this.pausedTime !== undefined) {
      return this.pausedTime;
    }
    return (this.synth.currentSynthTime - this.absoluteStartTime) * this._playbackRate;
  }
  set currentTime(time) {
    if (!this._midiData) {
      return;
    }
    if (this.paused) {
      this.pausedTime = time;
    }
    if (time > this._midiData.duration || time < 0) {
      if (this.skipToFirstNoteOn) {
        this.setTimeTicks(this._midiData.firstNoteOn - 1);
      } else {
        this.setTimeTicks(0);
      }
    } else if (this.skipToFirstNoteOn && time < this.firstNoteTime) {
      this.setTimeTicks(this._midiData.firstNoteOn - 1);
      return;
    } else {
      this.playingNotes = [];
      this.callEvent("timeChange", { newTime: time });
      this.setTimeTo(time);
      this.recalculateStartTime(time);
    }
  }
  get paused() {
    return this.pausedTime !== undefined;
  }
  play() {
    if (!this._midiData) {
      SpessaSynthWarn("No songs loaded in the sequencer. Ignoring the play call.");
      return;
    }
    if (this.currentTime >= this._midiData.duration) {
      this.currentTime = 0;
    }
    if (this.paused) {
      this.recalculateStartTime(this.pausedTime ?? 0);
    }
    if (this.retriggerPausedNotes) {
      this.playingNotes.forEach((n) => {
        this.sendMIDINoteOn(n.channel, n.midiNote, n.velocity);
      });
    }
    this.pausedTime = undefined;
  }
  pause() {
    this.pauseInternal(false);
  }
  loadNewSongList(midiBuffers) {
    this.songs = midiBuffers;
    if (this.songs.length < 1) {
      return;
    }
    this._songIndex = 0;
    this.shuffleSongIndexes();
    this.callEvent("songListChange", { newSongList: [...this.songs] });
    if (this.preload) {
      SpessaSynthGroup("%cPreloading all songs...", consoleColors.info);
      this.songs.forEach((song) => {
        if (song.embeddedSoundBank === undefined) {
          song.preloadSynth(this.synth);
        }
      });
      SpessaSynthGroupEnd();
    }
    this.loadCurrentSong();
  }
  callEvent(type, data) {
    this?.onEventCall?.({
      type,
      data
    });
  }
  pauseInternal(isFinished) {
    if (this.paused) {
      return;
    }
    this.stop();
    this.callEvent("pause", { isFinished });
    if (isFinished) {
      this.callEvent("songEnded", {});
    }
  }
  songIsFinished() {
    this.isFinished = true;
    if (this.songs.length === 1) {
      this.pauseInternal(true);
      return;
    }
    this._songIndex++;
    this._songIndex %= this.songs.length;
    this.loadCurrentSong();
  }
  stop() {
    this.pausedTime = this.currentTime;
    this.sendMIDIAllOff();
  }
  findFirstEventIndex() {
    let index = 0;
    let ticks = Infinity;
    this._midiData.tracks.forEach((track, i) => {
      if (this.eventIndexes[i] >= track.events.length) {
        return;
      }
      const event = track.events[this.eventIndexes[i]];
      if (event.ticks < ticks) {
        index = i;
        ticks = event.ticks;
      }
    });
    return index;
  }
  addNewMIDIPort() {
    for (let i = 0;i < 16; i++) {
      this.synth.createMIDIChannel();
    }
  }
  sendMIDIMessage(message) {
    if (!this.externalMIDIPlayback) {
      SpessaSynthWarn(`Attempting to send ${arrayToHexString(message)} to the synthesizer via sendMIDIMessage. This shouldn't happen!`);
      return;
    }
    this.callEvent("midiMessage", { message });
  }
  sendMIDIAllOff() {
    for (let i = 0;i < 16; i++) {
      this.sendMIDICC(i, midiControllers.sustainPedal, 0);
    }
    if (!this.externalMIDIPlayback) {
      this.synth.stopAllChannels();
      return;
    }
    this.playingNotes.forEach((note) => {
      this.sendMIDINoteOff(note.channel, note.midiNote);
    });
    for (let c = 0;c < MIDI_CHANNEL_COUNT; c++) {
      this.sendMIDICC(c, midiControllers.allNotesOff, 0);
      this.sendMIDICC(c, midiControllers.allSoundOff, 0);
    }
  }
  sendMIDIReset() {
    this.sendMIDIAllOff();
    if (!this.externalMIDIPlayback) {
      this.synth.resetAllControllers();
      return;
    }
    this.sendMIDIMessage([midiMessageTypes.reset]);
  }
  loadCurrentSong() {
    let index = this._songIndex;
    if (this._shuffleMode) {
      index = this.shuffledSongIndexes[this._songIndex];
    }
    this.loadNewSequence(this.songs[index]);
  }
  shuffleSongIndexes() {
    const indexes = this.songs.map((_, i) => i);
    this.shuffledSongIndexes = [];
    while (indexes.length > 0) {
      const index = indexes[Math.floor(Math.random() * indexes.length)];
      this.shuffledSongIndexes.push(index);
      indexes.splice(indexes.indexOf(index), 1);
    }
  }
  setTimeTicks(ticks) {
    if (!this._midiData) {
      return;
    }
    this.playingNotes = [];
    const seconds = this._midiData.midiTicksToSeconds(ticks);
    this.callEvent("timeChange", { newTime: seconds });
    const isNotFinished = this.setTimeTo(0, ticks);
    this.recalculateStartTime(this.playedTime);
    if (!isNotFinished) {
      return;
    }
  }
  recalculateStartTime(time) {
    this.absoluteStartTime = this.synth.currentSynthTime - time / this._playbackRate;
  }
  jumpToTick(targetTicks) {
    if (!this._midiData) {
      return;
    }
    this.sendMIDIAllOff();
    const seconds = this._midiData.midiTicksToSeconds(targetTicks);
    this.callEvent("timeChange", { newTime: seconds });
    this.recalculateStartTime(seconds);
    this.playedTime = seconds;
    this.eventIndexes.length = 0;
    for (const track of this._midiData.tracks) {
      const idx = track.events.findIndex((e) => e.ticks >= targetTicks);
      this.eventIndexes.push(idx < 0 ? track.events.length : idx);
    }
    const targetTempo = this._midiData.tempoChanges.find((t) => t.ticks <= targetTicks);
    this.oneTickToSeconds = 60 / (targetTempo.tempo * this._midiData.timeDivision);
  }
  sendMIDINoteOn(channel, midiNote, velocity) {
    if (!this.externalMIDIPlayback) {
      this.synth.noteOn(channel, midiNote, velocity);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      midiMessageTypes.noteOn | channel,
      midiNote,
      velocity
    ]);
  }
  sendMIDINoteOff(channel, midiNote) {
    if (!this.externalMIDIPlayback) {
      this.synth.noteOff(channel, midiNote);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      midiMessageTypes.noteOff | channel,
      midiNote,
      64
    ]);
  }
  sendMIDICC(channel, type, value) {
    if (!this.externalMIDIPlayback) {
      this.synth.controllerChange(channel, type, value);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      midiMessageTypes.controllerChange | channel,
      type,
      value
    ]);
  }
  sendMIDIProgramChange(channel, program) {
    if (!this.externalMIDIPlayback) {
      this.synth.programChange(channel, program);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      midiMessageTypes.programChange | channel,
      program
    ]);
  }
  sendMIDIPitchWheel(channel, pitch) {
    if (!this.externalMIDIPlayback) {
      this.synth.pitchWheel(channel, pitch);
      return;
    }
    channel %= 16;
    this.sendMIDIMessage([
      midiMessageTypes.pitchWheel | channel,
      pitch & 127,
      pitch >> 7
    ]);
  }
};
var stbvorbis = stbvorbis !== undefined ? stbvorbis : {};
var isReady = false;
var readySolver;
stbvorbis.isInitialized = new Promise((A) => readySolver = A);
var atob = function(A) {
  var I, g, B, E, Q, C, i, h = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", o = "", G = 0;
  A = A.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  do
    E = h.indexOf(A.charAt(G++)), Q = h.indexOf(A.charAt(G++)), C = h.indexOf(A.charAt(G++)), i = h.indexOf(A.charAt(G++)), I = E << 2 | Q >> 4, g = (15 & Q) << 4 | C >> 2, B = (3 & C) << 6 | i, o += String.fromCharCode(I), C !== 64 && (o += String.fromCharCode(g)), i !== 64 && (o += String.fromCharCode(B));
  while (G < A.length);
  return o;
};
(function() {
  var A, I, g, B, E, Q, C, i, h, o, G, D, a, S, F, R, s, w, y, c, n, U, $ = $ !== undefined ? $ : {};
  $.wasmBinary = Uint8Array.from(atob("AGFzbQEAAAABpQEYYAJ/fwF/YAF/AGAAAX9gBH9/f38AYAAAYAN/f38Bf2ABfwF/YAJ/fwBgBn9/f39/fwF/YAR/f39/AX9gBX9/f39/AX9gB39/f39/f38Bf2AGf39/f39/AGAIf39/f39/f38Bf2AFf39/f38AYAd/f39/f39/AGADf39/AGABfwF9YAF9AX1gAnx/AXxgAnx/AX9gA3x8fwF8YAJ8fAF8YAF8AXwCngIPA2VudgZtZW1vcnkCAIACA2VudgV0YWJsZQFwAQQEA2Vudgl0YWJsZUJhc2UDfwADZW52DkRZTkFNSUNUT1BfUFRSA38AA2VudghTVEFDS1RPUAN/AANlbnYJU1RBQ0tfTUFYA38ABmdsb2JhbAhJbmZpbml0eQN8AANlbnYFYWJvcnQAAQNlbnYNZW5sYXJnZU1lbW9yeQACA2Vudg5nZXRUb3RhbE1lbW9yeQACA2VudhdhYm9ydE9uQ2Fubm90R3Jvd01lbW9yeQACA2Vudg5fX19hc3NlcnRfZmFpbAADA2VudgtfX19zZXRFcnJObwABA2VudgZfYWJvcnQABANlbnYWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwAFA3d2BgYCAQcHAQIBAQcBCAcFAAkGCQoHBgYGBgEFBgIBBgYKAAgLAAYGBgYGBgYBAAoMDAMGBQANCAoJAAwODA8OAQAGBgcEABAJEAERAAADBQwAAAMHBxIGAQAABwIFEwMOBw8HBgYQFAoVExYXFxcXFgQFBQYFAAYkB38BIwELfwEjAgt/ASMDC38BQQALfwFBAAt8ASMEC38BQQALB9MCFRBfX2dyb3dXYXNtTWVtb3J5AAgRX19fZXJybm9fbG9jYXRpb24AYwVfZnJlZQBfB19tYWxsb2MAXgdfbWVtY3B5AHkHX21lbXNldAB6BV9zYnJrAHsXX3N0Yl92b3JiaXNfanNfY2hhbm5lbHMAJhRfc3RiX3ZvcmJpc19qc19jbG9zZQAlFV9zdGJfdm9yYmlzX2pzX2RlY29kZQAoE19zdGJfdm9yYmlzX2pzX29wZW4AJBpfc3RiX3ZvcmJpc19qc19zYW1wbGVfcmF0ZQAnC2R5bkNhbGxfaWlpAHwTZXN0YWJsaXNoU3RhY2tTcGFjZQAMC2dldFRlbXBSZXQwAA8LcnVuUG9zdFNldHMAeAtzZXRUZW1wUmV0MAAOCHNldFRocmV3AA0Kc3RhY2tBbGxvYwAJDHN0YWNrUmVzdG9yZQALCXN0YWNrU2F2ZQAKCQoBACMACwR9VFl9Csb2A3YGACAAQAALGwEBfyMGIQEjBiAAaiQGIwZBD2pBcHEkBiABCwQAIwYLBgAgACQGCwoAIAAkBiABJAcLEAAjCEUEQCAAJAggASQJCwsGACAAJAsLBAAjCwsRACAABEAgABARIAAgABASCwvvBwEKfyAAQYADaiEHIAcoAgAhBQJAIAUEQCAAQfwBaiEEIAQoAgAhASABQQBKBEAgAEHwAGohCANAIAUgAkEYbGpBEGohCSAJKAIAIQEgAQRAIAgoAgAhAyAFIAJBGGxqQQ1qIQogCi0AACEGIAZB/wFxIQYgAyAGQbAQbGpBBGohAyADKAIAIQMgA0EASgRAQQAhAwNAIAEgA0ECdGohASABKAIAIQEgACABEBIgA0EBaiEDIAgoAgAhASAKLQAAIQYgBkH/AXEhBiABIAZBsBBsakEEaiEBIAEoAgAhBiAJKAIAIQEgAyAGSA0ACwsgACABEBILIAUgAkEYbGpBFGohASABKAIAIQEgACABEBIgAkEBaiECIAQoAgAhASACIAFODQMgBygCACEFDAAACwALCwsgAEHwAGohAyADKAIAIQEgAQRAIABB7ABqIQUgBSgCACECIAJBAEoEQEEAIQIDQAJAIAEgAkGwEGxqQQhqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQRxqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQSBqIQQgBCgCACEEIAAgBBASIAEgAkGwEGxqQaQQaiEEIAQoAgAhBCAAIAQQEiABIAJBsBBsakGoEGohASABKAIAIQEgAUUhBCABQXxqIQFBACABIAQbIQEgACABEBIgAkEBaiECIAUoAgAhASACIAFODQAgAygCACEBDAELCyADKAIAIQELIAAgARASCyAAQfgBaiEBIAEoAgAhASAAIAEQEiAHKAIAIQEgACABEBIgAEGIA2ohAyADKAIAIQEgAQRAIABBhANqIQUgBSgCACECIAJBAEoEQEEAIQIDQCABIAJBKGxqQQRqIQEgASgCACEBIAAgARASIAJBAWohAiAFKAIAIQcgAygCACEBIAIgB0gNAAsLIAAgARASCyAAQQRqIQIgAigCACEBIAFBAEoEQEEAIQEDQCAAQZQGaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiAAQZQHaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiAAQdgHaiABQQJ0aiEDIAMoAgAhAyAAIAMQEiABQQFqIQEgAigCACEDIAEgA0ghAyABQRBJIQUgBSADcQ0ACwtBACEBA0AgAEGgCGogAUECdGohAiACKAIAIQIgACACEBIgAEGoCGogAUECdGohAiACKAIAIQIgACACEBIgAEGwCGogAUECdGohAiACKAIAIQIgACACEBIgAEG4CGogAUECdGohAiACKAIAIQIgACACEBIgAEHACGogAUECdGohAiACKAIAIQIgACACEBIgAUEBaiEBIAFBAkcNAAsLGwAgAEHEAGohACAAKAIAIQAgAEUEQCABEF8LC3wBAX8gAEHUB2ohASABQQA2AgAgAEGAC2ohASABQQA2AgAgAEH4CmohASABQQA2AgAgAEGcCGohASABQQA2AgAgAEHVCmohASABQQA6AAAgAEH8CmohASABQQA2AgAgAEHUC2ohASABQQA2AgAgAEHYC2ohACAAQQA2AgAL8AQBB38jBiELIwZBEGokBiALQQhqIQcgC0EEaiEKIAshCCAAQSRqIQYgBiwAACEGAn8gBgR/IABBgAtqIQYgBigCACEGIAZBf0oEQCAFQQA2AgAgACABIAIQFgwCCyAAQRRqIQYgBiABNgIAIAEgAmohAiAAQRxqIQkgCSACNgIAIABB2ABqIQIgAkEANgIAIABBABAXIQkgCUUEQCAFQQA2AgBBAAwCCyAAIAcgCCAKEBghCSAJBEAgBygCACECIAgoAgAhCSAKKAIAIQggACACIAkgCBAaIQogByAKNgIAIABBBGohAiACKAIAIQggCEEASgRAQQAhAgNAIABBlAZqIAJBAnRqIQcgBygCACEHIAcgCUECdGohByAAQdQGaiACQQJ0aiEMIAwgBzYCACACQQFqIQIgAiAISA0ACwsgAwRAIAMgCDYCAAsgBSAKNgIAIABB1AZqIQAgBCAANgIAIAYoAgAhACAAIAFrDAILAkACQAJAAkACQCACKAIAIgNBIGsOBAECAgACCyACQQA2AgAgAEHUAGohAiAAEBkhAwJAIANBf0cEQANAIAIoAgAhAyADDQIgABAZIQMgA0F/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ACECIABBmAhqIQYgBigCACEHIAUgA2shCSAJIAdqIQkgAiAJSSEJIAIgB0khDSACIAdrIQJBACACIA0bIQIgAiADaiECIAIgBUohByAFIAIgBxshAiAJBEAgASACNgIAIAYoAgAhACAAIAJqIQAgBiAANgIAQQEMBgsLCyAAQfQKaiECIAIoAgAhAiADIB9rIQYgBiACaiEGIABBmAhqIQIgAiAGNgIAIAhBATYCAAwBBSAAQZgIaiECIAYNAQsMAQsgBCADayEDIAIoAgAhBCADIARqIQMgAiADNgIACyATKAIAIQIgAgRAIABByABqIQIgAigCACECIABB0ABqIQAgACgCACEAIAIgAEcEQEHTE0HEE0HkGkHnFBAECwsgASAFNgIAQQELIQAgHCQGIAALqAIBBX8gAEHoCmohBSAFKAIAIQICQCACQQBIBEBBACEABSACIAFIBEAgAUEYSgRAIABBGBAsIQIgAUFoaiEBIAAgARAsIQAgAEEYdCEAIAAgAmohACAADwsgAkUEQCAAQeQKaiECIAJBADYCAAsgAEHkCmohAwJAAkACQANAIAAQLiECIAJBf0YNASAFKAIAIQQgAiAEdCECIAMoAgAhBiAGIAJqIQIgAyACNgIAIAUgBEEIaiICNgIAIAIgAUgNAAwCAAsACyAFQX82AgBBACEADAQLIARBeEgEQEEAIQAMBAsLCyAAQeQKaiEEIAQoAgAhA0EBIAF0IQAgAEF/aiEAIAMgAHEhACADIAF2IQMgBCADNgIAIAIgAWshASAFIAE2AgALCyAAC40CAAJAIABBAEgEf0EABSAAQYCAAUgEQCAAQRBIBEAgAEGACGohACAALAAAIQAMAwsgAEGABEgEQCAAQQV2IQAgAEGACGohACAALAAAIQAgAEEFaiEABSAAQQp2IQAgAEGACGohACAALAAAIQAgAEEKaiEACwwCCyAAQYCAgAhIBH8gAEGAgCBIBH8gAEEPdiEAIABBgAhqIQAgACwAACEAIABBD2oFIABBFHYhACAAQYAIaiEAIAAsAAAhACAAQRRqCwUgAEGAgICAAkgEfyAAQRl2IQAgAEGACGohACAALAAAIQAgAEEZagUgAEEediEAIABBgAhqIQAgACwAACEAIABBHmoLCwshAAsgAAuiAQEDfyAAQdQKaiECIAIsAAAhAQJAAkAgAQ0AIABB3ApqIQEgASgCACEBIAEEQEF/IQMFIAAQLyEBIAEEQCACLAAAIQEgAQ0CQaEUQcQTQfYLQbUUEAQFQX8hAwsLDAELIAFBf2pBGHRBGHUhASACIAE6AAAgAEHsCmohASABKAIAIQIgAkEBaiECIAEgAjYCACAAEDAhACAAQf8BcSEDCyADC6wCAQd/IABB3ApqIQIgAigCACEBAkAgAUUEQCAAQdgKaiEEIAQoAgAhASABQX9GBEAgAEHQCGohASABKAIAIQEgAUF/aiEBIABB4ApqIQMgAyABNgIAIAAQMSEBIAFFBEAgAkEBNgIADAMLIABB0wpqIQEgASwAACEBIAFBAXEhASABBH8gBCgCAAUgAEEgEBUMAwshAQsgAUEBaiEHIAQgBzYCACAAQdQIaiABaiEDIAMsAAAhBiAGQf8BcSEDIAZBf0cEQCACQQE2AgAgAEHgCmohAiACIAE2AgALIABB0AhqIQEgASgCACEBIAcgAU4EQCAEQX82AgALIABB1ApqIQAgACwAACEBIAEEQEHFFEHEE0HoC0HaFBAEBSAAIAY6AAAgAyEFCwsLIAULUQEDfyAAQRRqIQMgAygCACEBIABBHGohAiACKAIAIQIgASACSQR/IAFBAWohACADIAA2AgAgASwAAAUgAEHUAGohACAAQQE2AgBBAAshACAACyABAX8gABAyIQEgAQR/IAAQMwUgAEEeEBVBAAshACAAC2ABAX8gABAwIQEgAUH/AXFBzwBGBEAgABAwIQEgAUH/AXFB5wBGBEAgABAwIQEgAUH/AXFB5wBGBEAgABAwIQAgAEH/AXFB0wBGIQAFQQAhAAsFQQAhAAsFQQAhAAsgAAvZAwEGfyAAEDAhAQJ/IAFB/wFxBH8gAEEfEBVBAAUgABAwIQEgAEHTCmohAiACIAE6AAAgABAjIQUgABAjIQIgABAjGiAAECMhASAAQcwIaiEDIAMgATYCACAAECMaIAAQMCEBIAFB/wFxIQEgAEHQCGohAyADIAE2AgAgAEHUCGohBCAAIAQgARAiIQEgAUUEQCAAQQoQFUEADAILIABB8ApqIQQgBEF+NgIAIAIgBXEhAQJAIAFBf0cEQCADKAIAIQEgAUEASgRAA0ACQCABQX9qIQIgAEHUCGogAmohBiAGLAAAIQYgBkF/Rw0AIAFBAUwNBCACIQEMAQsLIAQgAjYCACAAQfQKaiEBIAEgBTYCAAsLCyAAQdUKaiEBIAEsAAAhASABBEAgAygCACEDIANBAEoEf0EAIQJBACEBA0AgAEHUCGogAWohBCAELQAAIQQgBEH/AXEhBCACIARqIQIgAUEBaiEBIAEgA0gNAAsgAkEbagVBGwshASAAQShqIQIgAigCACECIAEgA2ohASABIAJqIQEgAEEsaiEDIAMgAjYCACAAQTBqIQIgAiABNgIAIABBNGohASABIAU2AgALIABB2ApqIQAgAEEANgIAQQELCyEAIAALowEBB38gAEHoCmohAyADKAIAIQECQCABQRlIBEAgAEHkCmohBCABRQRAIARBADYCAAsgAEHUCmohBSAAQdwKaiEGA0AgBigCACEBIAEEQCAFLAAAIQEgAUUNAwsgABAuIQIgAkF/Rg0CIAMoAgAhASACIAF0IQIgBCgCACEHIAcgAmohAiAEIAI2AgAgAUEIaiECIAMgAjYCACABQRFIDQALCwsLrQUBCX8gABA0IAFBIGohAiACKAIAIQUCQAJAIAVFIgNFDQAgAUGkEGohAiACKAIAIQIgAg0AQX8hAQwBCyABQQRqIQIgAigCACECAkACQCACQQhKBEAgAUGkEGohAyADKAIAIQMgAw0BBSADDQELDAELIABB5ApqIQggCCgCACEJIAkQOiEHIAFBrBBqIQIgAigCACECIAJBAUoEQCABQaQQaigCACEKQQAhAwNAIAJBAXYhBSAFIANqIQQgCiAEQQJ0aiEGIAYoAgAhBiAGIAdLIQYgAiAFayECIAMgBCAGGyEDIAUgAiAGGyECIAJBAUoNAAsFQQAhAwsgAUEXaiECIAIsAAAhAiACRQRAIAFBqBBqIQIgAigCACECIAIgA0ECdGohAiACKAIAIQMLIAFBCGohASABKAIAIQEgASADaiEBIAEtAAAhASABQf8BcSEBIABB6ApqIQIgAigCACEAIAAgAUgEf0EAIQBBfwUgACABayEAIAkgAXYhASAIIAE2AgAgAwshASACIAA2AgAMAQsgAUEXaiEDIAMsAAAhAyADBEBBgRVBxBNB6gxBjBUQBAsCQCACQQBKBEAgASgCCCEIIABB5ApqIQlBACEBA0ACQCAIIAFqIQMgAywAACEEIARB/wFxIQMgBEF/RwRAIAUgAUECdGoh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IwZBEGokBiACIQECfCAAvUIgiKdB/////wdxIgNB/MOk/wNJBHwgA0GewZryA0kEfEQAAAAAAADwPwUgAEQAAAAAAAAAABByCwUgACAAoSADQf//v/8HSw0BGgJAAkACQAJAIAAgARBuQQNxDgMAAQIDCyABKwMAIAErAwgQcgwECyABKwMAIAErAwhBARBwmgwDCyABKwMAIAErAwgQcpoMAgsgASsDACABKwMIQQEQcAsLIQAgAiQGIAALywEBA38jBiECIwZBEGokBiACIQECQCAAvUIgiKdB/////wdxIgNB/MOk/wNJBEAgA0GAgMDyA08EQCAARAAAAAAAAAAAQQAQcCEACwUgA0H//7//B0sEQCAAIAChIQAMAgsCQAJAAkACQAJAIAAgARBuQQNxDgMAAQIDCyABKwMAIAErAwhBARBwIQAMBQsgASsDACABKwMIEHIhAAwECyABKwMAIAErAwhBARBwmiEADAMLIAErAwAgASsDCBBymiEACwsLIAIkBiAAC5sDAwJ/AX4CfCAAvSIDQj+IpyEBAnwCfwJAIANCIIinQf////8HcSICQarGmIQESwR8IANC////////////AINCgICAgICAgPj/AFYEQCAADwsgAETvOfr+Qi6GQGQEQCAARAAAAAAAAOB/og8FIABE0rx63SsjhsBjIABEUTAt1RBJh8BjcUUNAkQAAAAAAAAAACIADwsABSACQcLc2P4DSwRAIAJBscXC/wNLDQIgAUEBcyABawwDCyACQYCAwPEDSwR8QQAhASAABSAARAAAAAAAAPA/oA8LCwwCCyAARP6CK2VHFfc/oiABQQN0QYATaisDAKCqCyEBIAAgAbciBEQAAOD+Qi7mP6KhIgAgBER2PHk17znqPaIiBaELIQQgACAEIAQgBCAEoiIAIAAgACAAIABE0KS+cmk3Zj6iRPFr0sVBvbu+oKJELN4lr2pWET+gokSTvb4WbMFmv6CiRD5VVVVVVcU/oKKhIgCiRAAAAAAAAABAIAChoyAFoaBEAAAAAAAA8D+gIQAgAUUEQCAADwsgACABEGULnwMDAn8BfgV8IAC9IgNCIIinIQECfyADQgBTIgIgAUGAgMAASXIEfyADQv///////////wCDQgBRBEBEAAAAAAAA8L8gACAAoqMPCyACRQRAIABEAAAAAAAAUEOi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mgDjqR0AXmGRAAgb5gCFmWUAoBRfAI1AaACA2P8AJ3NNAAYGMQDKVhUAyahzAHviYABrjMAAQcMSC11A+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1AAAAAAAA4D8AAAAAAADgvwAAAAAAAPA/AAAAAAAA+D8AQagTCwgG0M9D6/1MPgBBuxMLigZAA7jiP09nZ1MuL3N0Yl92b3JiaXMuYwBmLT5hbGxvYy5hbGxvY19idWZmZXJfbGVuZ3RoX2luX2J5dGVzID09IGYtPnRlbXBfb2Zmc2V0AHZvcmJpc19kZWNvZGVfaW5pdGlhbABmLT5ieXRlc19pbl9zZWcgPiAwAGdldDhfcGFja2V0X3JhdwBmLT5ieXRlc19pbl9zZWcgPT0gMABuZXh0X3NlZ21lbnQAdm9yYmlzX2RlY29kZV9wYWNrZXRfcmVzdAAhYy0+c3BhcnNlAGNvZGVib29rX2RlY29kZV9zY2FsYXJfcmF3ACFjLT5zcGFyc2UgfHwgeiA8IGMtPnNvcnRlZF9lbnRyaWVzAGNvZGVib29rX2RlY29kZV9kZWludGVybGVhdmVfcmVwZWF0AHogPCBjLT5zb3J0ZWRfZW50cmllcwBjb2RlYm9va19kZWNvZGVfc3RhcnQAKG4gJiAzKSA9PSAwAGltZGN0X3N0ZXAzX2l0ZXIwX2xvb3AAMABnZXRfd2luZG93AGYtPnRlbXBfb2Zmc2V0ID09IGYtPmFsbG9jLmFsbG9jX2J1ZmZlcl9sZW5ndGhfaW5fYnl0ZXMAc3RhcnRfZGVjb2RlcgB2b3JiaXNjLT5zb3J0ZWRfZW50cmllcyA9PSAwAGNvbXB1dGVfY29kZXdvcmRzAHogPj0gMCAmJiB6IDwgMzIAbGVuW2ldID49IDAgJiYgbGVuW2ldIDwgMzIAYXZhaWxhYmxlW3ldID09IDAAayA9PSBjLT5zb3J0ZWRfZW50cmllcwBjb21wdXRlX3NvcnRlZF9odWZmbWFuAGMtPnNvcnRlZF9jb2Rld29yZHNbeF0gPT0gY29kZQBsZW4gIT0gTk9fQ09ERQBpbmNsdWRlX2luX3NvcnQAcG93KChmbG9hdCkgcisxLCBkaW0pID4gZW50cmllcwBsb29rdXAxX3ZhbHVlcwAoaW50KSBmbG9vcihwb3coKGZsb2F0KSByLCBkaW0pKSA8PSBlbnRyaWVzAOoPBG5hbWUB4g9+AAVhYm9ydAENZW5sYXJnZU1lbW9yeQIOZ2V0VG90YWxNZW1vcnkDF2Fib3J0T25DYW5ub3RHcm93TWVtb3J5BA5fX19hc3NlcnRfZmFpbAULX19fc2V0RXJyTm8GBl9hYm9ydAcWX2Vtc2NyaXB0ZW5fbWVtY3B5X2JpZwgQX19ncm93V2FzbU1lbW9yeQkKc3RhY2tBbGxvYwoJc3RhY2tTYXZlCwxzdGFja1Jlc3RvcmUME2VzdGFibGlzaFN0YWNrU3BhY2UNCHNldFRocmV3DgtzZXRUZW1wUmV0MA8LZ2V0VGVtcFJldDAQEV9zdGJfdm9yYmlzX2Nsb3NlEQ5fdm9yYmlzX2RlaW5pdBILX3NldHVwX2ZyZWUTGl9zdGJfdm9yYmlzX2ZsdXNoX3B1c2hkYXRhFCFfc3RiX3ZvcmJpc19kZWNvZGVfZnJhbWVfcHVzaGRhdGEVBl9lcnJvchYgX3ZvcmJpc19zZWFyY2hfZm9yX3BhZ2VfcHVzaGRhdGEXGF9pc193aG9sZV9wYWNrZXRfcHJlc2VudBgVX3ZvcmJpc19kZWNvZGVfcGFja2V0GQxfZ2V0OF9wYWNrZXQaFF92b3JiaXNfZmluaXNoX2ZyYW1lGxlfc3RiX3ZvcmJpc19vcGVuX3B1c2hkYXRhHAxfdm9yYmlzX2luaXQdDl9zdGFydF9kZWNvZGVyHg1fdm9yYmlzX2FsbG9jHxtfc3RiX3ZvcmJpc19nZXRfZmlsZV9vZmZzZXQgE19tYXliZV9zdGFydF9wYWNrZXQhDV9mbHVzaF9wYWNrZXQiBV9nZXRuIwZfZ2V0MzIkE19zdGJfdm9yYmlzX2pzX29wZW4lFF9zdGJfdm9yYmlzX2pzX2Nsb3NlJhdfc3RiX3ZvcmJpc19qc19jaGFubmVscycaX3N0Yl92b3JiaXNfanNfc2FtcGxlX3JhdGUoFV9zdGJfdm9yYmlzX2pzX2RlY29kZSkNX2NyYzMyX3VwZGF0ZSoWX3ZvcmJpc19kZWNvZGVfaW5pdGlhbCsaX3ZvcmJpc19kZWNvZGVfcGFja2V0X3Jlc3QsCV9nZXRfYml0cy0FX2lsb2cuEF9nZXQ4X3BhY2tldF9yYXcvDV9uZXh0X3NlZ21lbnQwBV9nZXQ4MQtfc3RhcnRfcGFnZTIQX2NhcHR1cmVfcGF0dGVybjMdX3N0YXJ0X3BhZ2Vfbm9fY2FwdHVyZXBhdHRlcm40DV9wcmVwX2h1ZmZtYW41G19jb2RlYm9va19kZWNvZGVfc2NhbGFyX3JhdzYOX3ByZWRpY3RfcG9pbnQ3D19kZWNvZGVfcmVzaWR1ZTgJX2RvX2Zsb29yOQ1faW52ZXJzZV9tZGN0OgxfYml0X3JldmVyc2U7EV9tYWtlX2Jsb2NrX2FycmF5PBJfc2V0dXBfdGVtcF9tYWxsb2M9JF9jb2RlYm9va19kZWNvZGVfZGVpbnRlcmxlYXZlX3JlcGVhdD4PX3Jlc2lkdWVfZGVjb2RlPxVfY29kZWJvb2tfZGVjb2RlX3N0ZXBAEF9jb2RlYm9va19kZWNvZGVBFl9jb2RlYm9va19kZWNvZGVfc3RhcnRCCl9kcmF3X2xpbmVDF19pbWRjdF9zdGVwM19pdGVyMF9sb29wRBlfaW1kY3Rfc3RlcDNfaW5uZXJfcl9sb29wRRlfaW1kY3Rfc3RlcDNfaW5uZXJfc19sb29wRh9faW1kY3Rfc3RlcDNfaW5uZXJfc19sb29wX2xkNjU0RwhfaXRlcl81NEgLX2dldF93aW5kb3dJEF92b3JiaXNfdmFsaWRhdGVKDV9zdGFydF9wYWNrZXRLBV9za2lwTAtfY3JjMzJfaW5pdE0NX3NldHVwX21hbGxvY04QX3NldHVwX3RlbXBfZnJlZU8SX2NvbXB1dGVfY29kZXdvcmRzUBdfY29tcHV0ZV9zb3J0ZWRfaHVmZm1hblEcX2NvbXB1dGVfYWNjZWxlcmF0ZWRfaHVmZm1hblIPX2Zsb2F0MzJfdW5wYWNrUw9fbG9va3VwMV92YWx1ZXNUDl9wb2ludF9jb21wYXJlVQpfbmVpZ2hib3JzVg9faW5pdF9ibG9ja3NpemVXCl9hZGRfZW50cnlYEF9pbmNsdWRlX2luX3NvcnRZD191aW50MzJfY29tcGFyZVoYX2NvbXB1dGVfdHdpZGRsZV9mYWN0b3JzWw9fY29tcHV0ZV93aW5kb3dcE19jb21wdXRlX2JpdHJldmVyc2VdB19zcXVhcmVeB19tYWxsb2NfBV9mcmVlYAhfcmVhbGxvY2ESX3RyeV9yZWFsbG9jX2NodW5rYg5fZGlzcG9zZV9jaHVua2MRX19fZXJybm9fbG9jYXRpb25kB19tZW1jbXBlB19zY2FsYm5mBl9xc29ydGcFX3NpZnRoBF9zaHJpCF90cmlua2xlagRfc2hsawVfcG50emwIX2FfY3R6X2xtBl9jeWNsZW4LX19fcmVtX3BpbzJvEV9fX3JlbV9waW8yX2xhcmdlcAZfX19zaW5xBl9sZGV4cHIGX19fY29zcwRfY29zdARfc2ludQRfZXhwdgRfbG9ndwRfcG93eAtydW5Qb3N0U2V0c3kHX21lbWNweXoHX21lbXNldHsFX3Nicmt8C2R5bkNhbGxfaWlpfQJiMA=="), function(A10) {
    return A10.charCodeAt(0);
  });
  var $ = $ !== undefined ? $ : {}, e = {};
  for (A in $)
    $.hasOwnProperty(A) && (e[A] = $[A]);
  $.arguments = [], $.thisProgram = "./this.program", $.quit = function(A10, I2) {
    throw I2;
  }, $.preRun = [], $.postRun = [];
  var t = false, k = false, N = false, r = false;
  t = typeof window == "object", k = typeof importScripts == "function", N = typeof process == "object" && typeof __require2 == "function" && !t && !k, r = !t && !N && !k;
  var Y = "";
  function J(A10) {
    return $.locateFile ? $.locateFile(A10, Y) : Y + A10;
  }
  N ? (Y = "/", $.read = function A10(B2, E2) {
    var Q2;
    return I || (I = undefined), g || (g = undefined), B2 = g.normalize(B2), Q2 = I.readFileSync(B2), E2 ? Q2 : Q2.toString();
  }, $.readBinary = function A10(I2) {
    var g2 = $.read(I2, true);
    return g2.buffer || (g2 = new Uint8Array(g2)), _(g2.buffer), g2;
  }, process.argv.length > 1 && ($.thisProgram = process.argv[1].replace(/\\/g, "/")), $.arguments = process.argv.slice(2), process.on("uncaughtException", function(A10) {
    if (!(A10 instanceof II))
      throw A10;
  }), process.on("unhandledRejection", function(A10, I2) {
    process.exit(1);
  }), $.quit = function(A10) {
    process.exit(A10);
  }, $.inspect = function() {
    return "[Emscripten Module object]";
  }) : r ? (typeof read != "undefined" && ($.read = function A10(I2) {
    return read(I2);
  }), $.readBinary = function A10(I2) {
    var g2;
    return typeof readbuffer == "function" ? new Uint8Array(readbuffer(I2)) : (_(typeof (g2 = read(I2, "binary")) == "object"), g2);
  }, typeof scriptArgs != "undefined" ? $.arguments = scriptArgs : typeof arguments != "undefined" && ($.arguments = arguments), typeof quit == "function" && ($.quit = function(A10) {
    quit(A10);
  })) : (t || k) && (t ? document.currentScript && (Y = document.currentScript.src) : Y = self.location.href, Y = Y.indexOf("blob:") !== 0 ? Y.split("/").slice(0, -1).join("/") + "/" : "", $.read = function A10(I2) {
    var g2 = new XMLHttpRequest;
    return g2.open("GET", I2, false), g2.send(null), g2.responseText;
  }, k && ($.readBinary = function A10(I2) {
    var g2 = new XMLHttpRequest;
    return g2.open("GET", I2, false), g2.responseType = "arraybuffer", g2.send(null), new Uint8Array(g2.response);
  }), $.readAsync = function A10(I2, g2, B2) {
    var E2 = new XMLHttpRequest;
    E2.open("GET", I2, true), E2.responseType = "arraybuffer", E2.onload = function A11() {
      if (E2.status == 200 || E2.status == 0 && E2.response) {
        g2(E2.response);
        return;
      }
      B2();
    }, E2.onerror = B2, E2.send(null);
  }, $.setWindowTitle = function(A10) {
    document.title = A10;
  });
  var f = $.print || (typeof console != "undefined" ? console.log.bind(console) : typeof print != "undefined" ? print : null), H = $.printErr || (typeof printErr != "undefined" ? printErr : typeof console != "undefined" && console.warn.bind(console) || f);
  for (A in e)
    e.hasOwnProperty(A) && ($[A] = e[A]);
  function L(A10) {
    var I2 = S;
    return S = S + A10 + 15 & -16, I2;
  }
  function M(A10) {
    var I2 = h[c >> 2], g2 = I2 + A10 + 15 & -16;
    return (h[c >> 2] = g2, g2 >= AN && !Ae()) ? (h[c >> 2] = I2, 0) : I2;
  }
  function d(A10, I2) {
    return I2 || (I2 = 16), A10 = Math.ceil(A10 / I2) * I2;
  }
  function q(A10) {
    switch (A10) {
      case "i1":
      case "i8":
        return 1;
      case "i16":
        return 2;
      case "i32":
      case "float":
        return 4;
      case "i64":
      case "double":
        return 8;
      default:
        if (A10[A10.length - 1] === "*")
          return 4;
        if (A10[0] !== "i")
          return 0;
        var I2 = parseInt(A10.substr(1));
        return _(I2 % 8 == 0), I2 / 8;
    }
  }
  function K(A10) {
    K.shown || (K.shown = {}), K.shown[A10] || (K.shown[A10] = 1, H(A10));
  }
  e = undefined;
  var l = { "f64-rem": function(A10, I2) {
    return A10 % I2;
  }, debugger: function() {} }, u = [];
  function b(A10, I2) {
    for (var g2 = 0, B2 = g2;B2 < g2 + 0; B2++)
      if (!u[B2])
        return u[B2] = A10, 1 + B2;
    throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
  }
  function X(A10) {
    u[A10 - 1] = null;
  }
  var m = {};
  function Z(A10, I2) {
    if (A10) {
      _(I2), m[I2] || (m[I2] = {});
      var g2 = m[I2];
      return g2[A10] || (I2.length === 1 ? g2[A10] = function g3() {
        return V(I2, A10);
      } : I2.length === 2 ? g2[A10] = function g3(B2) {
        return V(I2, A10, [B2]);
      } : g2[A10] = function g3() {
        return V(I2, A10, Array.prototype.slice.call(arguments));
      }), g2[A10];
    }
  }
  function x(A10, I2, g2) {
    return g2 ? +(A10 >>> 0) + 4294967296 * +(I2 >>> 0) : +(A10 >>> 0) + 4294967296 * +(0 | I2);
  }
  function V(A10, I2, g2) {
    return g2 && g2.length ? $["dynCall_" + A10].apply(null, [I2].concat(g2)) : $["dynCall_" + A10].call(null, I2);
  }
  var p = 0, W = 0;
  function _(A10, I2) {
    A10 || IE("Assertion failed: " + I2);
  }
  function T(A10) {
    var I2 = $["_" + A10];
    return _(I2, "Cannot call unknown function " + A10 + ", make sure it is exported"), I2;
  }
  var v = { stackSave: function() {
    IA();
  }, stackRestore: function() {
    A9();
  }, arrayToC: function(A10) {
    var I2, g2, B2 = A5(A10.length);
    return I2 = A10, g2 = B2, E.set(I2, g2), B2;
  }, stringToC: function(A10) {
    var I2 = 0;
    if (A10 != null && A10 !== 0) {
      var g2 = (A10.length << 2) + 1;
      I2 = A5(g2), Ai(A10, I2, g2);
    }
    return I2;
  } }, O = { string: v.stringToC, array: v.arrayToC };
  function j(A10, I2, g2, B2, E2) {
    var Q2 = T(A10), C2 = [], i2 = 0;
    if (B2)
      for (var h2 = 0;h2 < B2.length; h2++) {
        var o2 = O[g2[h2]];
        o2 ? (i2 === 0 && (i2 = IA()), C2[h2] = o2(B2[h2])) : C2[h2] = B2[h2];
      }
    var G2, D2 = Q2.apply(null, C2);
    return D2 = (G2 = D2, I2 === "string" ? Ag(G2) : I2 === "boolean" ? Boolean(G2) : G2), i2 !== 0 && A9(i2), D2;
  }
  function P(A10, I2, g2, B2) {
    switch ((g2 = g2 || "i8").charAt(g2.length - 1) === "*" && (g2 = "i32"), g2) {
      case "i1":
      case "i8":
        E[A10 >> 0] = I2;
        break;
      case "i16":
        C[A10 >> 1] = I2;
        break;
      case "i32":
        h[A10 >> 2] = I2;
        break;
      case "i64":
        tempI64 = [I2 >>> 0, +Ax(tempDouble = I2) >= 1 ? tempDouble > 0 ? (0 | Ap(+A6(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+AV((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0], h[A10 >> 2] = tempI64[0], h[A10 + 4 >> 2] = tempI64[1];
        break;
      case "float":
        G[A10 >> 2] = I2;
        break;
      case "double":
        D[A10 >> 3] = I2;
        break;
      default:
        IE("invalid type for setValue: " + g2);
    }
  }
  function z(A10, I2, g2) {
    switch ((I2 = I2 || "i8").charAt(I2.length - 1) === "*" && (I2 = "i32"), I2) {
      case "i1":
      case "i8":
        return E[A10 >> 0];
      case "i16":
        return C[A10 >> 1];
      case "i32":
      case "i64":
        return h[A10 >> 2];
      case "float":
        return G[A10 >> 2];
      case "double":
        return D[A10 >> 3];
      default:
        IE("invalid type for getValue: " + I2);
    }
    return null;
  }
  function AA(A10, I2, g2, B2) {
    typeof A10 == "number" ? (i2 = true, o2 = A10) : (i2 = false, o2 = A10.length);
    var C2 = typeof I2 == "string" ? I2 : null;
    if (G2 = g2 == 4 ? B2 : [typeof A8 == "function" ? A8 : L, A5, L, M][g2 === undefined ? 2 : g2](Math.max(o2, C2 ? 1 : I2.length)), i2) {
      for (B2 = G2, _((3 & G2) == 0), D2 = G2 + (-4 & o2);B2 < D2; B2 += 4)
        h[B2 >> 2] = 0;
      for (D2 = G2 + o2;B2 < D2; )
        E[B2++ >> 0] = 0;
      return G2;
    }
    if (C2 === "i8")
      return A10.subarray || A10.slice ? Q.set(A10, G2) : Q.set(new Uint8Array(A10), G2), G2;
    for (var i2, o2, G2, D2, a2, S2, F2, R2 = 0;R2 < o2; ) {
      var s2 = A10[R2];
      if ((a2 = C2 || I2[R2]) === 0) {
        R2++;
        continue;
      }
      a2 == "i64" && (a2 = "i32"), P(G2 + R2, s2, a2), F2 !== a2 && (S2 = q(a2), F2 = a2), R2 += S2;
    }
    return G2;
  }
  function AI(A10) {
    return F ? A0 ? A8(A10) : M(A10) : L(A10);
  }
  function Ag(A10, I2) {
    if (I2 === 0 || !A10)
      return "";
    for (var g2, B2, E2, C2 = 0, i2 = 0;C2 |= B2 = Q[A10 + i2 >> 0], (B2 != 0 || I2) && (i2++, !I2 || i2 != I2); )
      ;
    I2 || (I2 = i2);
    var h2 = "";
    if (C2 < 128) {
      for (;I2 > 0; )
        E2 = String.fromCharCode.apply(String, Q.subarray(A10, A10 + Math.min(I2, 1024))), h2 = h2 ? h2 + E2 : E2, A10 += 1024, I2 -= 1024;
      return h2;
    }
    return g2 = A10, function A11(I3, g3) {
      for (var B3 = g3;I3[B3]; )
        ++B3;
      if (B3 - g3 > 16 && I3.subarray && AQ)
        return AQ.decode(I3.subarray(g3, B3));
      for (var E3, Q2, C3, i3, h3, o2, G2 = "";; ) {
        if (!(E3 = I3[g3++]))
          return G2;
        if (!(128 & E3)) {
          G2 += String.fromCharCode(E3);
          continue;
        }
        if (Q2 = 63 & I3[g3++], (224 & E3) == 192) {
          G2 += String.fromCharCode((31 & E3) << 6 | Q2);
          continue;
        }
        if (C3 = 63 & I3[g3++], (240 & E3) == 224 ? E3 = (15 & E3) << 12 | Q2 << 6 | C3 : (i3 = 63 & I3[g3++], (248 & E3) == 240 ? E3 = (7 & E3) << 18 | Q2 << 12 | C3 << 6 | i3 : (h3 = 63 & I3[g3++], E3 = (252 & E3) == 248 ? (3 & E3) << 24 | Q2 << 18 | C3 << 12 | i3 << 6 | h3 : (1 & E3) << 30 | Q2 << 24 | C3 << 18 | i3 << 12 | h3 << 6 | (o2 = 63 & I3[g3++]))), E3 < 65536)
          G2 += String.fromCharCode(E3);
        else {
          var D2 = E3 - 65536;
          G2 += String.fromCharCode(55296 | D2 >> 10, 56320 | 1023 & D2);
        }
      }
    }(Q, g2);
  }
  function AB(A10) {
    for (var I2 = "";; ) {
      var g2 = E[A10++ >> 0];
      if (!g2)
        return I2;
      I2 += String.fromCharCode(g2);
    }
  }
  function AE(A10, I2) {
    return function A11(I3, g2, B2) {
      for (var Q2 = 0;Q2 < I3.length; ++Q2)
        E[g2++ >> 0] = I3.charCodeAt(Q2);
      B2 || (E[g2 >> 0] = 0);
    }(A10, I2, false);
  }
  var AQ = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : undefined;
  function AC(A10, I2, g2, B2) {
    if (!(B2 > 0))
      return 0;
    for (var E2 = g2, Q2 = g2 + B2 - 1, C2 = 0;C2 < A10.length; ++C2) {
      var i2 = A10.charCodeAt(C2);
      if (i2 >= 55296 && i2 <= 57343 && (i2 = 65536 + ((1023 & i2) << 10) | 1023 & A10.charCodeAt(++C2)), i2 <= 127) {
        if (g2 >= Q2)
          break;
        I2[g2++] = i2;
      } else if (i2 <= 2047) {
        if (g2 + 1 >= Q2)
          break;
        I2[g2++] = 192 | i2 >> 6, I2[g2++] = 128 | 63 & i2;
      } else if (i2 <= 65535) {
        if (g2 + 2 >= Q2)
          break;
        I2[g2++] = 224 | i2 >> 12, I2[g2++] = 128 | i2 >> 6 & 63, I2[g2++] = 128 | 63 & i2;
      } else if (i2 <= 2097151) {
        if (g2 + 3 >= Q2)
          break;
        I2[g2++] = 240 | i2 >> 18, I2[g2++] = 128 | i2 >> 12 & 63, I2[g2++] = 128 | i2 >> 6 & 63, I2[g2++] = 128 | 63 & i2;
      } else if (i2 <= 67108863) {
        if (g2 + 4 >= Q2)
          break;
        I2[g2++] = 248 | i2 >> 24, I2[g2++] = 128 | i2 >> 18 & 63, I2[g2++] = 128 | i2 >> 12 & 63, I2[g2++] = 128 | i2 >> 6 & 63, I2[g2++] = 128 | 63 & i2;
      } else {
        if (g2 + 5 >= Q2)
          break;
        I2[g2++] = 252 | i2 >> 30, I2[g2++] = 128 | i2 >> 24 & 63, I2[g2++] = 128 | i2 >> 18 & 63, I2[g2++] = 128 | i2 >> 12 & 63, I2[g2++] = 128 | i2 >> 6 & 63, I2[g2++] = 128 | 63 & i2;
      }
    }
    return I2[g2] = 0, g2 - E2;
  }
  function Ai(A10, I2, g2) {
    return AC(A10, Q, I2, g2);
  }
  function Ah(A10) {
    for (var I2 = 0, g2 = 0;g2 < A10.length; ++g2) {
      var B2 = A10.charCodeAt(g2);
      B2 >= 55296 && B2 <= 57343 && (B2 = 65536 + ((1023 & B2) << 10) | 1023 & A10.charCodeAt(++g2)), B2 <= 127 ? ++I2 : B2 <= 2047 ? I2 += 2 : B2 <= 65535 ? I2 += 3 : B2 <= 2097151 ? I2 += 4 : B2 <= 67108863 ? I2 += 5 : I2 += 6;
    }
    return I2;
  }
  var Ao = typeof TextDecoder != "undefined" ? new TextDecoder("utf-16le") : undefined;
  function AG(A10) {
    for (var I2 = A10, g2 = I2 >> 1;C[g2]; )
      ++g2;
    if ((I2 = g2 << 1) - A10 > 32 && Ao)
      return Ao.decode(Q.subarray(A10, I2));
    for (var B2 = 0, E2 = "";; ) {
      var i2 = C[A10 + 2 * B2 >> 1];
      if (i2 == 0)
        return E2;
      ++B2, E2 += String.fromCharCode(i2);
    }
  }
  function AD(A10, I2, g2) {
    if (g2 === undefined && (g2 = 2147483647), g2 < 2)
      return 0;
    for (var B2 = I2, E2 = (g2 -= 2) < 2 * A10.length ? g2 / 2 : A10.length, Q2 = 0;Q2 < E2; ++Q2) {
      var i2 = A10.charCodeAt(Q2);
      C[I2 >> 1] = i2, I2 += 2;
    }
    return C[I2 >> 1] = 0, I2 - B2;
  }
  function Aa(A10) {
    return 2 * A10.length;
  }
  function AS(A10) {
    for (var I2 = 0, g2 = "";; ) {
      var B2 = h[A10 + 4 * I2 >> 2];
      if (B2 == 0)
        return g2;
      if (++I2, B2 >= 65536) {
        var E2 = B2 - 65536;
        g2 += String.fromCharCode(55296 | E2 >> 10, 56320 | 1023 & E2);
      } else
        g2 += String.fromCharCode(B2);
    }
  }
  function AF(A10, I2, g2) {
    if (g2 === undefined && (g2 = 2147483647), g2 < 4)
      return 0;
    for (var B2 = I2, E2 = B2 + g2 - 4, Q2 = 0;Q2 < A10.length; ++Q2) {
      var C2 = A10.charCodeAt(Q2);
      if (C2 >= 55296 && C2 <= 57343 && (C2 = 65536 + ((1023 & C2) << 10) | 1023 & A10.charCodeAt(++Q2)), h[I2 >> 2] = C2, (I2 += 4) + 4 > E2)
        break;
    }
    return h[I2 >> 2] = 0, I2 - B2;
  }
  function AR(A10) {
    for (var I2 = 0, g2 = 0;g2 < A10.length; ++g2) {
      var B2 = A10.charCodeAt(g2);
      B2 >= 55296 && B2 <= 57343 && ++g2, I2 += 4;
    }
    return I2;
  }
  function As(A10) {
    var I2 = Ah(A10) + 1, g2 = A8(I2);
    return g2 && AC(A10, E, g2, I2), g2;
  }
  function Aw(A10) {
    var I2 = Ah(A10) + 1, g2 = A5(I2);
    return AC(A10, E, g2, I2), g2;
  }
  function Ay(A10) {
    return A10;
  }
  function Ac() {
    var A10, I2 = function A11() {
      var I3 = Error();
      if (!I3.stack) {
        try {
          throw Error(0);
        } catch (g2) {
          I3 = g2;
        }
        if (!I3.stack)
          return "(no stack trace available)";
      }
      return I3.stack.toString();
    }();
    return $.extraStackTrace && (I2 += `
` + $.extraStackTrace()), (A10 = I2).replace(/__Z[\w\d_]+/g, function(A11) {
      var I3, g2 = I3 = A11;
      return A11 === g2 ? A11 : A11 + " [" + g2 + "]";
    });
  }
  function An(A10, I2) {
    return A10 % I2 > 0 && (A10 += I2 - A10 % I2), A10;
  }
  function AU(A10) {
    $.buffer = B = A10;
  }
  function A$() {
    $.HEAP8 = E = new Int8Array(B), $.HEAP16 = C = new Int16Array(B), $.HEAP32 = h = new Int32Array(B), $.HEAPU8 = Q = new Uint8Array(B), $.HEAPU16 = i = new Uint16Array(B), $.HEAPU32 = o = new Uint32Array(B), $.HEAPF32 = G = new Float32Array(B), $.HEAPF64 = D = new Float64Array(B);
  }
  function Ae() {
    var A10 = $.usingWasm ? 65536 : 16777216, I2 = 2147483648 - A10;
    if (h[c >> 2] > I2)
      return false;
    var g2 = AN;
    for (AN = Math.max(AN, 16777216);AN < h[c >> 2]; )
      AN = AN <= 536870912 ? An(2 * AN, A10) : Math.min(An((3 * AN + 2147483648) / 4, A10), I2);
    var B2 = $.reallocBuffer(AN);
    return B2 && B2.byteLength == AN ? (AU(B2), A$(), true) : (AN = g2, false);
  }
  a = S = R = s = w = y = c = 0, F = false, $.reallocBuffer || ($.reallocBuffer = function(A10) {
    try {
      if (ArrayBuffer.transfer)
        I2 = ArrayBuffer.transfer(B, A10);
      else {
        var I2, g2 = E;
        I2 = new ArrayBuffer(A10), new Int8Array(I2).set(g2);
      }
    } catch (Q2) {
      return false;
    }
    return !!Az(I2) && I2;
  });
  try {
    (n = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get))(new ArrayBuffer(4));
  } catch (At) {
    n = function(A10) {
      return A10.byteLength;
    };
  }
  var Ak = $.TOTAL_STACK || 5242880, AN = $.TOTAL_MEMORY || 16777216;
  function Ar() {
    return AN;
  }
  function AY(A10) {
    for (;A10.length > 0; ) {
      var I2 = A10.shift();
      if (typeof I2 == "function") {
        I2();
        continue;
      }
      var g2 = I2.func;
      typeof g2 == "number" ? I2.arg === undefined ? $.dynCall_v(g2) : $.dynCall_vi(g2, I2.arg) : g2(I2.arg === undefined ? null : I2.arg);
    }
  }
  AN < Ak && H("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + AN + "! (TOTAL_STACK=" + Ak + ")"), $.buffer ? B = $.buffer : (typeof WebAssembly == "object" && typeof WebAssembly.Memory == "function" ? ($.wasmMemory = new WebAssembly.Memory({ initial: AN / 65536 }), B = $.wasmMemory.buffer) : B = new ArrayBuffer(AN), $.buffer = B), A$();
  var AJ = [], Af = [], AH = [], AL = [], AM = [], A0 = false, Ad = false;
  function Aq(A10) {
    AJ.unshift(A10);
  }
  function AK(A10) {
    Af.unshift(A10);
  }
  function Al(A10) {
    AH.unshift(A10);
  }
  function Au(A10) {
    AL.unshift(A10);
  }
  function Ab(A10) {
    AM.unshift(A10);
  }
  function AX(A10, I2, g2) {
    var B2, Q2;
    K("writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!"), g2 && (B2 = E[Q2 = I2 + Ah(A10)]), Ai(A10, I2, 1 / 0), g2 && (E[Q2] = B2);
  }
  function Am(A10, I2, g2) {
    return A10 >= 0 ? A10 : I2 <= 32 ? 2 * Math.abs(1 << I2 - 1) + A10 : Math.pow(2, I2) + A10;
  }
  function AZ(A10, I2, g2) {
    if (A10 <= 0)
      return A10;
    var B2 = I2 <= 32 ? Math.abs(1 << I2 - 1) : Math.pow(2, I2 - 1);
    return A10 >= B2 && (I2 <= 32 || A10 > B2) && (A10 = -2 * B2 + A10), A10;
  }
  var { abs: Ax, ceil: AV, floor: A6, min: Ap } = Math, A7 = 0, A1 = null, AW = null;
  function A_(A10) {
    return A10;
  }
  $.preloadedImages = {}, $.preloadedAudios = {};
  var AT = "data:application/octet-stream;base64,";
  function A2(A10) {
    return String.prototype.startsWith ? A10.startsWith(AT) : A10.indexOf(AT) === 0;
  }
  (function A10() {
    var I2 = "main.wast", g2 = "main.wasm", B2 = "main.temp.asm";
    A2(I2) || (I2 = J(I2)), A2(g2) || (g2 = J(g2)), A2(B2) || (B2 = J(B2));
    var E2 = { global: null, env: null, asm2wasm: l, parent: $ }, Q2 = null;
    function C2(A11) {
      return A11;
    }
    function i2() {
      try {
        if ($.wasmBinary)
          return new Uint8Array($.wasmBinary);
        if ($.readBinary)
          return $.readBinary(g2);
        throw "both async and sync fetching of the wasm failed";
      } catch (A11) {
        IE(A11);
      }
    }
    $.asmPreload = $.asm;
    var h2 = $.reallocBuffer, o2 = function(A11) {
      A11 = An(A11, $.usingWasm ? 65536 : 16777216);
      var I3 = $.buffer.byteLength;
      if ($.usingWasm)
        try {
          var g3 = $.wasmMemory.grow((A11 - I3) / 65536);
          if (g3 !== -1)
            return $.buffer = $.wasmMemory.buffer;
          return null;
        } catch (B3) {
          return null;
        }
    };
    $.reallocBuffer = function(A11) {
      return G2 === "asmjs" ? h2(A11) : o2(A11);
    };
    var G2 = "";
    $.asm = function(A11, I3, B3) {
      var C3;
      if (!(I3 = C3 = I3).table) {
        var h3, o3 = $.wasmTableSize;
        o3 === undefined && (o3 = 1024);
        var G3 = $.wasmMaxTableSize;
        typeof WebAssembly == "object" && typeof WebAssembly.Table == "function" ? G3 !== undefined ? I3.table = new WebAssembly.Table({ initial: o3, maximum: G3, element: "anyfunc" }) : I3.table = new WebAssembly.Table({ initial: o3, element: "anyfunc" }) : I3.table = Array(o3), $.wasmTable = I3.table;
      }
      return I3.memoryBase || (I3.memoryBase = $.STATIC_BASE), I3.tableBase || (I3.tableBase = 0), h3 = function A12(I4, B4, C4) {
        if (typeof WebAssembly != "object")
          return H("no native wasm support detected"), false;
        if (!($.wasmMemory instanceof WebAssembly.Memory))
          return H("no native wasm Memory in use"), false;
        function h4(A13, I5) {
          if ((Q2 = A13.exports).memory) {
            var g3, B5, E3;
            g3 = Q2.memory, B5 = $.buffer, g3.byteLength < B5.byteLength && H("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here"), E3 = new Int8Array(B5), new Int8Array(g3).set(E3), AU(g3), A$();
          }
          $.asm = Q2, $.usingWasm = true, function A14(I6) {
            if (A7--, $.monitorRunDependencies && $.monitorRunDependencies(A7), A7 == 0 && (A1 !== null && (clearInterval(A1), A1 = null), AW)) {
              var g4 = AW;
              AW = null, g4();
            }
          }("wasm-instantiate");
        }
        B4.memory = $.wasmMemory, E2.global = { NaN: NaN, Infinity: 1 / 0 }, E2["global.Math"] = Math, E2.env = B4;
        if (A7++, $.monitorRunDependencies && $.monitorRunDependencies(A7), $.instantiateWasm)
          try {
            return $.instantiateWasm(E2, h4);
          } catch (o4) {
            return H("Module.instantiateWasm callback failed with error: " + o4), false;
          }
        function G4(A13) {
          h4(A13.instance, A13.module);
        }
        function D2(A13) {
          (!$.wasmBinary && (t || k) && typeof fetch == "function" ? fetch(g2, { credentials: "same-origin" }).then(function(A14) {
            if (!A14.ok)
              throw "failed to load wasm binary file at '" + g2 + "'";
            return A14.arrayBuffer();
          }).catch(function() {
            return i2();
          }) : new Promise(function(A14, I5) {
            A14(i2());
          })).then(function(A14) {
            return WebAssembly.instantiate(A14, E2);
          }).then(A13).catch(function(A14) {
            H("failed to asynchronously prepare wasm: " + A14), IE(A14);
          });
        }
        return $.wasmBinary || typeof WebAssembly.instantiateStreaming != "function" || A2(g2) || typeof fetch != "function" ? D2(G4) : WebAssembly.instantiateStreaming(fetch(g2, { credentials: "same-origin" }), E2).then(G4).catch(function(A13) {
          H("wasm streaming compile failed: " + A13), H("falling back to ArrayBuffer instantiation"), D2(G4);
        }), {};
      }(A11, I3, B3), _(h3, "no binaryen method succeeded."), h3;
    }, $.asm;
  })(), S = (a = 1024) + 4816, Af.push(), $.STATIC_BASE = a, $.STATIC_BUMP = 4816;
  var Av = S;
  function AO(A10) {
    E[Av] = E[A10], E[Av + 1] = E[A10 + 1], E[Av + 2] = E[A10 + 2], E[Av + 3] = E[A10 + 3];
  }
  function Aj(A10) {
    E[Av] = E[A10], E[Av + 1] = E[A10 + 1], E[Av + 2] = E[A10 + 2], E[Av + 3] = E[A10 + 3], E[Av + 4] = E[A10 + 4], E[Av + 5] = E[A10 + 5], E[Av + 6] = E[A10 + 6], E[Av + 7] = E[A10 + 7];
  }
  function AP(A10, I2, g2) {
    var B2 = g2 > 0 ? g2 : Ah(A10) + 1, E2 = Array(B2), Q2 = AC(A10, E2, 0, E2.length);
    return I2 && (E2.length = Q2), E2;
  }
  function A4(A10) {
    for (var I2 = [], g2 = 0;g2 < A10.length; g2++) {
      var B2 = A10[g2];
      B2 > 255 && (B2 &= 255), I2.push(String.fromCharCode(B2));
    }
    return I2.join("");
  }
  S += 16, c = L(4), w = (R = s = d(S)) + Ak, y = d(w), h[c >> 2] = y, F = true, $.wasmTableSize = 4, $.wasmMaxTableSize = 4, $.asmGlobalArg = {}, $.asmLibraryArg = { abort: IE, assert: _, enlargeMemory: Ae, getTotalMemory: Ar, abortOnCannotGrowMemory: function A10() {
    IE("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + AN + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
  }, invoke_iii: function A10(I2, g2, B2) {
    var E2 = IA();
    try {
      return $.dynCall_iii(I2, g2, B2);
    } catch (Q2) {
      if (A9(E2), typeof Q2 != "number" && Q2 !== "longjmp")
        throw Q2;
      $.setThrew(1, 0);
    }
  }, ___assert_fail: function A10(I2, g2, B2, E2) {
    IE("Assertion failed: " + Ag(I2) + ", at: " + [g2 ? Ag(g2) : "unknown filename", B2, E2 ? Ag(E2) : "unknown function"]);
  }, ___setErrNo: function A10(I2) {
    return $.___errno_location && (h[$.___errno_location() >> 2] = I2), I2;
  }, _abort: function A10() {
    $.abort();
  }, _emscripten_memcpy_big: function A10(I2, g2, B2) {
    return Q.set(Q.subarray(g2, g2 + B2), I2), I2;
  }, _llvm_floor_f64: A6, DYNAMICTOP_PTR: c, tempDoublePtr: Av, ABORT: p, STACKTOP: s, STACK_MAX: w };
  var A3 = $.asm($.asmGlobalArg, $.asmLibraryArg, B);
  $.asm = A3, $.___errno_location = function() {
    return $.asm.___errno_location.apply(null, arguments);
  };
  var Az = $._emscripten_replace_memory = function() {
    return $.asm._emscripten_replace_memory.apply(null, arguments);
  };
  $._free = function() {
    return $.asm._free.apply(null, arguments);
  };
  var A8 = $._malloc = function() {
    return $.asm._malloc.apply(null, arguments);
  };
  $._memcpy = function() {
    return $.asm._memcpy.apply(null, arguments);
  }, $._memset = function() {
    return $.asm._memset.apply(null, arguments);
  }, $._sbrk = function() {
    return $.asm._sbrk.apply(null, arguments);
  }, $._stb_vorbis_js_channels = function() {
    return $.asm._stb_vorbis_js_channels.apply(null, arguments);
  }, $._stb_vorbis_js_close = function() {
    return $.asm._stb_vorbis_js_close.apply(null, arguments);
  }, $._stb_vorbis_js_decode = function() {
    return $.asm._stb_vorbis_js_decode.apply(null, arguments);
  }, $._stb_vorbis_js_open = function() {
    return $.asm._stb_vorbis_js_open.apply(null, arguments);
  }, $._stb_vorbis_js_sample_rate = function() {
    return $.asm._stb_vorbis_js_sample_rate.apply(null, arguments);
  }, $.establishStackSpace = function() {
    return $.asm.establishStackSpace.apply(null, arguments);
  }, $.getTempRet0 = function() {
    return $.asm.getTempRet0.apply(null, arguments);
  }, $.runPostSets = function() {
    return $.asm.runPostSets.apply(null, arguments);
  }, $.setTempRet0 = function() {
    return $.asm.setTempRet0.apply(null, arguments);
  }, $.setThrew = function() {
    return $.asm.setThrew.apply(null, arguments);
  };
  var A5 = $.stackAlloc = function() {
    return $.asm.stackAlloc.apply(null, arguments);
  }, A9 = $.stackRestore = function() {
    return $.asm.stackRestore.apply(null, arguments);
  }, IA = $.stackSave = function() {
    return $.asm.stackSave.apply(null, arguments);
  };
  function II(A10) {
    this.name = "ExitStatus", this.message = "Program terminated with exit(" + A10 + ")", this.status = A10;
  }
  function Ig(A10) {
    if (A10 = A10 || $.arguments, !(A7 > 0))
      (function A11() {
        if ($.preRun)
          for (typeof $.preRun == "function" && ($.preRun = [$.preRun]);$.preRun.length; )
            Aq($.preRun.shift());
        AY(AJ);
      })(), !(A7 > 0) && ($.calledRun || ($.setStatus ? ($.setStatus("Running..."), setTimeout(function() {
        setTimeout(function() {
          $.setStatus("");
        }, 1), I2();
      }, 1)) : I2()));
    function I2() {
      !$.calledRun && ($.calledRun = true, p || (A0 || (A0 = true, AY(Af)), AY(AH), $.onRuntimeInitialized && $.onRuntimeInitialized(), function A11() {
        if ($.postRun)
          for (typeof $.postRun == "function" && ($.postRun = [$.postRun]);$.postRun.length; )
            Ab($.postRun.shift());
        AY(AM);
      }()));
    }
  }
  function IB(A10, I2) {
    (!I2 || !$.noExitRuntime || A10 !== 0) && ($.noExitRuntime || (p = true, W = A10, s = U, AY(AL), Ad = true, $.onExit && $.onExit(A10)), $.quit(A10, new II(A10)));
  }
  function IE(A10) {
    throw $.onAbort && $.onAbort(A10), A10 !== undefined ? (f(A10), H(A10), A10 = JSON.stringify(A10)) : A10 = "", p = true, W = 1, "abort(" + A10 + "). Build with -s ASSERTIONS=1 for more info.";
  }
  if ($.dynCall_iii = function() {
    return $.asm.dynCall_iii.apply(null, arguments);
  }, $.asm = A3, $.ccall = j, $.cwrap = function A10(I2, g2, B2, E2) {
    var Q2 = (B2 = B2 || []).every(function(A11) {
      return A11 === "number";
    });
    return g2 !== "string" && Q2 && !E2 ? T(I2) : function() {
      return j(I2, g2, B2, arguments, E2);
    };
  }, II.prototype = Error(), II.prototype.constructor = II, AW = function A10() {
    $.calledRun || Ig(), $.calledRun || (AW = A10);
  }, $.run = Ig, $.abort = IE, $.preInit)
    for (typeof $.preInit == "function" && ($.preInit = [$.preInit]);$.preInit.length > 0; )
      $.preInit.pop()();
  $.noExitRuntime = true, Ig(), $.onRuntimeInitialized = () => {
    isReady = true, readySolver();
  }, stbvorbis.decode = function(A10) {
    return function A11(I2) {
      if (!isReady)
        throw Error("SF3 decoder has not been initialized yet. Did you await synth.isReady?");
      var g2 = {};
      function B2(A12) {
        return new Int32Array($.HEAPU8.buffer, A12, 1)[0];
      }
      function E2(A12, I3) {
        var g3 = new ArrayBuffer(I3 * Float32Array.BYTES_PER_ELEMENT), B3 = new Float32Array(g3);
        return B3.set(new Float32Array($.HEAPU8.buffer, A12, I3)), B3;
      }
      g2.open = $.cwrap("stb_vorbis_js_open", "number", []), g2.close = $.cwrap("stb_vorbis_js_close", "void", ["number"]), g2.channels = $.cwrap("stb_vorbis_js_channels", "number", ["number"]), g2.sampleRate = $.cwrap("stb_vorbis_js_sample_rate", "number", ["number"]), g2.decode = $.cwrap("stb_vorbis_js_decode", "number", ["number", "number", "number", "number", "number"]);
      var Q2, C2, i2, h2, o2 = g2.open(), G2 = (Q2 = I2, C2 = I2.byteLength, i2 = $._malloc(C2), (h2 = new Uint8Array($.HEAPU8.buffer, i2, C2)).set(new Uint8Array(Q2, 0, C2)), h2), D2 = $._malloc(4), a2 = $._malloc(4), S2 = g2.decode(o2, G2.byteOffset, G2.byteLength, D2, a2);
      if ($._free(G2.byteOffset), S2 < 0)
        throw g2.close(o2), $._free(D2), Error("stbvorbis decode failed: " + S2);
      for (var F2 = g2.channels(o2), R2 = Array(F2), s2 = new Int32Array($.HEAPU32.buffer, B2(D2), F2), w2 = 0;w2 < F2; w2++)
        R2[w2] = E2(s2[w2], S2), $._free(s2[w2]);
      var y2 = g2.sampleRate(o2);
      return g2.close(o2), $._free(B2(D2)), $._free(D2), { data: R2, sampleRate: y2, eof: true, error: null };
    }(A10);
  };
})();
var stb = stbvorbis;
var MIN_TIMECENT = -15000;
var MAX_TIMECENT = 15000;
var timecentLookupTable = new Float32Array(MAX_TIMECENT - MIN_TIMECENT + 1);
for (let i = 0;i < timecentLookupTable.length; i++) {
  const timecents = MIN_TIMECENT + i;
  timecentLookupTable[i] = Math.pow(2, timecents / 1200);
}
function timecentsToSeconds(timecents) {
  if (timecents <= -32767) {
    return 0;
  }
  return timecentLookupTable[timecents - MIN_TIMECENT];
}
var MIN_ABS_CENT = -20000;
var MAX_ABS_CENT = 16500;
var absoluteCentLookupTable = new Float32Array(MAX_ABS_CENT - MIN_ABS_CENT + 1);
for (let i = 0;i < absoluteCentLookupTable.length; i++) {
  const absoluteCents = MIN_ABS_CENT + i;
  absoluteCentLookupTable[i] = 440 * Math.pow(2, (absoluteCents - 6900) / 1200);
}
function absCentsToHz(cents) {
  if (cents < MIN_ABS_CENT || cents > MAX_ABS_CENT) {
    return 440 * Math.pow(2, (cents - 6900) / 1200);
  }
  return absoluteCentLookupTable[~~cents - MIN_ABS_CENT];
}
var MIN_DECIBELS = -1660;
var MAX_DECIBELS = 1600;
var decibelLookUpTable = new Float32Array((MAX_DECIBELS - MIN_DECIBELS) * 100 + 1);
for (let i = 0;i < decibelLookUpTable.length; i++) {
  const decibels = (MIN_DECIBELS * 100 + i) / 100;
  decibelLookUpTable[i] = Math.pow(10, -decibels / 20);
}
function decibelAttenuationToGain(decibels) {
  return decibelLookUpTable[Math.floor((decibels - MIN_DECIBELS) * 100)];
}
var VOLUME_ENVELOPE_SMOOTHING_FACTOR = 0.01;
var DB_SILENCE = 100;
var PERCEIVED_DB_SILENCE = 90;
var PERCEIVED_GAIN_SILENCE = 0.000015;
var VolumeEnvelope = class _VolumeEnvelope {
  sampleRate;
  currentAttenuationDb = DB_SILENCE;
  state = 0;
  attenuation = 0;
  attenuationTargetGain = 0;
  currentSampleTime = 0;
  releaseStartDb = DB_SILENCE;
  releaseStartTimeSamples = 0;
  currentReleaseGain = 1;
  attackDuration = 0;
  decayDuration = 0;
  releaseDuration = 0;
  attenuationTarget = 0;
  sustainDbRelative = 0;
  delayEnd = 0;
  attackEnd = 0;
  holdEnd = 0;
  decayEnd = 0;
  canEndOnSilentSustain;
  constructor(sampleRate, initialDecay) {
    this.sampleRate = sampleRate;
    this.canEndOnSilentSustain = initialDecay / 10 >= PERCEIVED_DB_SILENCE;
  }
  static startRelease(voice) {
    voice.volumeEnvelope.releaseStartTimeSamples = voice.volumeEnvelope.currentSampleTime;
    voice.volumeEnvelope.currentReleaseGain = decibelAttenuationToGain(voice.volumeEnvelope.currentAttenuationDb);
    _VolumeEnvelope.recalculate(voice);
  }
  static recalculate(voice) {
    const env = voice.volumeEnvelope;
    const timecentsToSamples = (tc) => {
      return Math.max(0, Math.floor(timecentsToSeconds(tc) * env.sampleRate));
    };
    env.attenuationTarget = Math.max(0, Math.min(voice.modulatedGenerators[generatorTypes.initialAttenuation], 1440)) / 10;
    env.attenuationTargetGain = decibelAttenuationToGain(env.attenuationTarget);
    env.sustainDbRelative = Math.min(DB_SILENCE, voice.modulatedGenerators[generatorTypes.sustainVolEnv] / 10);
    const sustainDb = Math.min(DB_SILENCE, env.sustainDbRelative);
    env.attackDuration = timecentsToSamples(voice.modulatedGenerators[generatorTypes.attackVolEnv]);
    const fullChange = voice.modulatedGenerators[generatorTypes.decayVolEnv];
    const keyNumAddition = (60 - voice.targetKey) * voice.modulatedGenerators[generatorTypes.keyNumToVolEnvDecay];
    const fraction = sustainDb / DB_SILENCE;
    env.decayDuration = timecentsToSamples(fullChange + keyNumAddition) * fraction;
    env.releaseDuration = timecentsToSamples(Math.max(-7200, voice.modulatedGenerators[generatorTypes.releaseVolEnv]));
    env.delayEnd = timecentsToSamples(voice.modulatedGenerators[generatorTypes.delayVolEnv]);
    env.attackEnd = env.attackDuration + env.delayEnd;
    const holdExcursion = (60 - voice.targetKey) * voice.modulatedGenerators[generatorTypes.keyNumToVolEnvHold];
    env.holdEnd = timecentsToSamples(voice.modulatedGenerators[generatorTypes.holdVolEnv] + holdExcursion) + env.attackEnd;
    env.decayEnd = env.decayDuration + env.holdEnd;
    if (env.state === 0 && env.attackEnd === 0) {
      env.state = 2;
    }
    if (voice.isInRelease) {
      const sustainDb2 = Math.max(0, Math.min(DB_SILENCE, env.sustainDbRelative));
      const fraction2 = sustainDb2 / DB_SILENCE;
      env.decayDuration = timecentsToSamples(fullChange + keyNumAddition) * fraction2;
      switch (env.state) {
        case 0:
          env.releaseStartDb = DB_SILENCE;
          break;
        case 1: {
          const elapsed = 1 - (env.attackEnd - env.releaseStartTimeSamples) / env.attackDuration;
          env.releaseStartDb = 20 * Math.log10(elapsed) * -1;
          break;
        }
        case 2:
          env.releaseStartDb = 0;
          break;
        case 3:
          env.releaseStartDb = (1 - (env.decayEnd - env.releaseStartTimeSamples) / env.decayDuration) * sustainDb2;
          break;
        case 4:
          env.releaseStartDb = sustainDb2;
          break;
      }
      env.releaseStartDb = Math.max(0, Math.min(env.releaseStartDb, DB_SILENCE));
      if (env.releaseStartDb >= PERCEIVED_DB_SILENCE) {
        voice.finished = true;
      }
      env.currentReleaseGain = decibelAttenuationToGain(env.releaseStartDb);
      const releaseFraction = (DB_SILENCE - env.releaseStartDb) / DB_SILENCE;
      env.releaseDuration *= releaseFraction;
    }
  }
  static apply(voice, audioBuffer, centibelOffset, smoothingFactor) {
    const env = voice.volumeEnvelope;
    const decibelOffset = centibelOffset / 10;
    const attenuationSmoothing = smoothingFactor;
    if (voice.isInRelease) {
      let elapsedRelease = env.currentSampleTime - env.releaseStartTimeSamples;
      if (elapsedRelease >= env.releaseDuration) {
        for (let i = 0;i < audioBuffer.length; i++) {
          audioBuffer[i] = 0;
        }
        voice.finished = true;
        return;
      }
      const dbDifference = DB_SILENCE - env.releaseStartDb;
      for (let i = 0;i < audioBuffer.length; i++) {
        env.attenuation += (env.attenuationTargetGain - env.attenuation) * attenuationSmoothing;
        const db = elapsedRelease / env.releaseDuration * dbDifference + env.releaseStartDb;
        env.currentReleaseGain = env.attenuation * decibelAttenuationToGain(db + decibelOffset);
        audioBuffer[i] *= env.currentReleaseGain;
        env.currentSampleTime++;
        elapsedRelease++;
      }
      if (env.currentReleaseGain <= PERCEIVED_GAIN_SILENCE) {
        voice.finished = true;
      }
      return;
    }
    let filledBuffer = 0;
    switch (env.state) {
      case 0:
        while (env.currentSampleTime < env.delayEnd) {
          env.currentAttenuationDb = DB_SILENCE;
          audioBuffer[filledBuffer] = 0;
          env.currentSampleTime++;
          if (++filledBuffer >= audioBuffer.length) {
            return;
          }
        }
        env.state++;
      case 1:
        while (env.currentSampleTime < env.attackEnd) {
          env.attenuation += (env.attenuationTargetGain - env.attenuation) * attenuationSmoothing;
          const linearAttenuation = 1 - (env.attackEnd - env.currentSampleTime) / env.attackDuration;
          audioBuffer[filledBuffer] *= linearAttenuation * env.attenuation * decibelAttenuationToGain(decibelOffset);
          env.currentAttenuationDb = 0;
          env.currentSampleTime++;
          if (++filledBuffer >= audioBuffer.length) {
            return;
          }
        }
        env.state++;
      case 2:
        while (env.currentSampleTime < env.holdEnd) {
          env.attenuation += (env.attenuationTargetGain - env.attenuation) * attenuationSmoothing;
          audioBuffer[filledBuffer] *= env.attenuation * decibelAttenuationToGain(decibelOffset);
          env.currentAttenuationDb = 0;
          env.currentSampleTime++;
          if (++filledBuffer >= audioBuffer.length) {
            return;
          }
        }
        env.state++;
      case 3:
        while (env.currentSampleTime < env.decayEnd) {
          env.attenuation += (env.attenuationTargetGain - env.attenuation) * attenuationSmoothing;
          env.currentAttenuationDb = (1 - (env.decayEnd - env.currentSampleTime) / env.decayDuration) * env.sustainDbRelative;
          audioBuffer[filledBuffer] *= env.attenuation * decibelAttenuationToGain(env.currentAttenuationDb + decibelOffset);
          env.currentSampleTime++;
          if (++filledBuffer >= audioBuffer.length) {
            return;
          }
        }
        env.state++;
      case 4:
        if (env.canEndOnSilentSustain && env.sustainDbRelative >= PERCEIVED_DB_SILENCE) {
          voice.finished = true;
        }
        while (true) {
          env.attenuation += (env.attenuationTargetGain - env.attenuation) * attenuationSmoothing;
          audioBuffer[filledBuffer] *= env.attenuation * decibelAttenuationToGain(env.sustainDbRelative + decibelOffset);
          env.currentAttenuationDb = env.sustainDbRelative;
          env.currentSampleTime++;
          if (++filledBuffer >= audioBuffer.length) {
            return;
          }
        }
    }
  }
};
function setMasterParameterInternal(parameter, value) {
  this.privateProps.masterParameters[parameter] = value;
  switch (parameter) {
    case "masterPan": {
      let pan = value;
      pan = pan / 2 + 0.5;
      this.privateProps.panLeft = 1 - pan;
      this.privateProps.panRight = pan;
      break;
    }
    case "masterGain":
      break;
    case "voiceCap":
      break;
    case "interpolationType":
      break;
    case "midiSystem":
      break;
    case "monophonicRetriggerMode":
      break;
    case "transposition": {
      const semitones = value;
      this.privateProps.masterParameters.transposition = 0;
      for (const item of this.midiChannels) {
        item.transposeChannel(semitones);
      }
      this.privateProps.masterParameters.transposition = semitones;
    }
  }
  this.callEvent("masterParameterChange", {
    parameter,
    value
  });
}
function getMasterParameterInternal(type) {
  return this.privateProps.masterParameters[type];
}
function getAllMasterParametersInternal() {
  return { ...this.privateProps.masterParameters };
}
function bitMaskToBool(num, bit) {
  return (num >> bit & 1) > 0;
}
function toNumericBool(bool) {
  return bool ? 1 : 0;
}
var MODULATOR_RESOLUTION = 16384;
var MOD_CURVE_TYPES_AMOUNT = Object.keys(modulatorCurveTypes).length;
var MOD_SOURCE_TRANSFORM_POSSIBILITIES = 4;
var concave = new Float32Array(MODULATOR_RESOLUTION + 1);
var convex = new Float32Array(MODULATOR_RESOLUTION + 1);
concave[0] = 0;
concave[concave.length - 1] = 1;
convex[0] = 0;
convex[convex.length - 1] = 1;
for (let i = 1;i < MODULATOR_RESOLUTION - 1; i++) {
  const x = -200 * 2 / 960 * Math.log(i / (concave.length - 1)) / Math.LN10;
  convex[i] = 1 - x;
  concave[concave.length - 1 - i] = x;
}
function getModulatorCurveValue(transformType, curveType, value) {
  const isBipolar = !!(transformType & 2);
  const isNegative = !!(transformType & 1);
  if (isNegative) {
    value = 1 - value;
  }
  switch (curveType) {
    case modulatorCurveTypes.linear:
      if (isBipolar) {
        return value * 2 - 1;
      }
      return value;
    case modulatorCurveTypes.switch:
      value = value > 0.5 ? 1 : 0;
      if (isBipolar) {
        return value * 2 - 1;
      }
      return value;
    case modulatorCurveTypes.concave:
      if (isBipolar) {
        value = value * 2 - 1;
        if (value < 0) {
          return -concave[~~(value * -MODULATOR_RESOLUTION)];
        }
        return concave[~~(value * MODULATOR_RESOLUTION)];
      }
      return concave[~~(value * MODULATOR_RESOLUTION)];
    case modulatorCurveTypes.convex:
      if (isBipolar) {
        value = value * 2 - 1;
        if (value < 0) {
          return -convex[~~(value * -MODULATOR_RESOLUTION)];
        }
        return convex[~~(value * MODULATOR_RESOLUTION)];
      }
      return convex[~~(value * MODULATOR_RESOLUTION)];
  }
}
var ModulatorSource = class _ModulatorSource {
  isBipolar;
  isNegative;
  index;
  isCC;
  curveType;
  constructor(index = modulatorSources.noController, curveType = modulatorCurveTypes.linear, isCC = false, isBipolar = false, isNegative = false) {
    this.isBipolar = isBipolar;
    this.isNegative = isNegative;
    this.index = index;
    this.isCC = isCC;
    this.curveType = curveType;
  }
  get sourceName() {
    return this.isCC ? Object.keys(midiControllers).find((k) => midiControllers[k] === this.index) ?? this.index.toString() : Object.keys(modulatorSources).find((k) => modulatorSources[k] === this.index) ?? this.index.toString();
  }
  get curveTypeName() {
    return Object.keys(modulatorCurveTypes).find((k) => modulatorCurveTypes[k] === this.curveType) ?? this.curveType.toString();
  }
  static fromSourceEnum(sourceEnum) {
    const isBipolar = bitMaskToBool(sourceEnum, 9);
    const isNegative = bitMaskToBool(sourceEnum, 8);
    const isCC = bitMaskToBool(sourceEnum, 7);
    const index = sourceEnum & 127;
    const curveType = sourceEnum >> 10 & 3;
    return new _ModulatorSource(index, curveType, isCC, isBipolar, isNegative);
  }
  static copyFrom(source) {
    return new _ModulatorSource(source.index, source.curveType, source.isCC, source.isBipolar, source.isNegative);
  }
  toString() {
    return `${this.sourceName} ${this.curveTypeName} ${this.isBipolar ? "bipolar" : "unipolar"} ${this.isNegative ? "negative" : "positive"}`;
  }
  toSourceEnum() {
    return this.curveType << 10 | toNumericBool(this.isBipolar) << 9 | toNumericBool(this.isNegative) << 8 | toNumericBool(this.isCC) << 7 | this.index;
  }
  isIdentical(source) {
    return this.index === source.index && this.isNegative === source.isNegative && this.isCC === source.isCC && this.isBipolar === source.isBipolar && this.curveType === source.curveType;
  }
  getValue(midiControllers2, voice) {
    let rawValue;
    if (this.isCC) {
      rawValue = midiControllers2[this.index];
    } else {
      switch (this.index) {
        case modulatorSources.noController:
          rawValue = 16383;
          break;
        case modulatorSources.noteOnKeyNum:
          rawValue = voice.midiNote << 7;
          break;
        case modulatorSources.noteOnVelocity:
          rawValue = voice.velocity << 7;
          break;
        case modulatorSources.polyPressure:
          rawValue = voice.pressure << 7;
          break;
        default:
          rawValue = midiControllers2[this.index + NON_CC_INDEX_OFFSET];
          break;
      }
    }
    const transformType = (this.isBipolar ? 2 : 0) | (this.isNegative ? 1 : 0);
    return precomputedTransforms[MODULATOR_RESOLUTION * (this.curveType * MOD_CURVE_TYPES_AMOUNT + transformType) + rawValue];
  }
};
var precomputedTransforms = new Float32Array(MODULATOR_RESOLUTION * MOD_SOURCE_TRANSFORM_POSSIBILITIES * MOD_CURVE_TYPES_AMOUNT);
for (let curveType = 0;curveType < MOD_CURVE_TYPES_AMOUNT; curveType++) {
  for (let transformType = 0;transformType < MOD_SOURCE_TRANSFORM_POSSIBILITIES; transformType++) {
    const tableIndex = MODULATOR_RESOLUTION * (curveType * MOD_CURVE_TYPES_AMOUNT + transformType);
    for (let value = 0;value < MODULATOR_RESOLUTION; value++) {
      precomputedTransforms[tableIndex + value] = getModulatorCurveValue(transformType, curveType, value / MODULATOR_RESOLUTION);
    }
  }
}
var MOD_BYTE_SIZE = 10;
function getModSourceEnum(curveType, isBipolar, isNegative, isCC, index) {
  return new ModulatorSource(index, curveType, isCC, isBipolar, isNegative).toSourceEnum();
}
var defaultResonantModSource = getModSourceEnum(modulatorCurveTypes.linear, true, false, true, midiControllers.filterResonance);
var Modulator = class _Modulator {
  currentValue = 0;
  destination = generatorTypes.initialAttenuation;
  transformAmount = 0;
  transformType = 0;
  isEffectModulator = false;
  isDefaultResonantModulator = false;
  primarySource;
  secondarySource;
  constructor(primarySource = new ModulatorSource, secondarySource = new ModulatorSource, destination = generatorTypes.INVALID, amount = 0, transformType = 0, isEffectModulator = false, isDefaultResonantModulator = false) {
    this.primarySource = primarySource;
    this.secondarySource = secondarySource;
    this.destination = destination;
    this.transformAmount = amount;
    this.transformType = transformType;
    this.isEffectModulator = isEffectModulator;
    this.isDefaultResonantModulator = isDefaultResonantModulator;
  }
  get destinationName() {
    return Object.keys(generatorTypes).find((k) => generatorTypes[k] === this.destination);
  }
  static isIdentical(mod1, mod2, checkAmount = false) {
    return mod1.primarySource.isIdentical(mod2.primarySource) && mod1.secondarySource.isIdentical(mod2.secondarySource) && mod1.destination === mod2.destination && mod1.transformType === mod2.transformType && (!checkAmount || mod1.transformAmount === mod2.transformAmount);
  }
  static copyFrom(mod) {
    return new _Modulator(ModulatorSource.copyFrom(mod.primarySource), ModulatorSource.copyFrom(mod.secondarySource), mod.destination, mod.transformAmount, mod.transformType, mod.isEffectModulator, mod.isDefaultResonantModulator);
  }
  toString() {
    return `Source: ${this.primarySource.toString()}
Secondary source: ${this.secondarySource.toString()}
to: ${this.destinationName}
amount: ${this.transformAmount}` + (this.transformType === 2 ? "absolute value" : "");
  }
  write(modData, indexes) {
    writeWord(modData, this.primarySource.toSourceEnum());
    writeWord(modData, this.destination);
    writeWord(modData, this.transformAmount);
    writeWord(modData, this.secondarySource.toSourceEnum());
    writeWord(modData, this.transformType);
    if (!indexes) {
      return;
    }
    indexes.mod++;
  }
  sumTransform(modulator) {
    const m = _Modulator.copyFrom(this);
    m.transformAmount += modulator.transformAmount;
    return m;
  }
};
var DecodedModulator = class extends Modulator {
  constructor(sourceEnum, secondarySourceEnum, destination, amount, transformType) {
    const isEffectModulator = (sourceEnum === 219 || sourceEnum === 221) && secondarySourceEnum === 0 && (destination === generatorTypes.reverbEffectsSend || destination === generatorTypes.chorusEffectsSend);
    const isDefaultResonantModulator = sourceEnum === defaultResonantModSource && secondarySourceEnum === 0 && destination === generatorTypes.initialFilterQ;
    super(ModulatorSource.fromSourceEnum(sourceEnum), ModulatorSource.fromSourceEnum(secondarySourceEnum), destination, amount, transformType, isEffectModulator, isDefaultResonantModulator);
    if (this.destination > MAX_GENERATOR) {
      this.destination = generatorTypes.INVALID;
    }
  }
};
var DEFAULT_ATTENUATION_MOD_AMOUNT = 960;
var DEFAULT_ATTENUATION_MOD_CURVE_TYPE = modulatorCurveTypes.concave;
var defaultSoundFont2Modulators = [
  new DecodedModulator(getModSourceEnum(DEFAULT_ATTENUATION_MOD_CURVE_TYPE, false, true, false, modulatorSources.noteOnVelocity), 0, generatorTypes.initialAttenuation, DEFAULT_ATTENUATION_MOD_AMOUNT, 0),
  new DecodedModulator(129, 0, generatorTypes.vibLfoToPitch, 50, 0),
  new DecodedModulator(getModSourceEnum(DEFAULT_ATTENUATION_MOD_CURVE_TYPE, false, true, true, midiControllers.mainVolume), 0, generatorTypes.initialAttenuation, DEFAULT_ATTENUATION_MOD_AMOUNT, 0),
  new DecodedModulator(13, 0, generatorTypes.vibLfoToPitch, 50, 0),
  new DecodedModulator(526, 16, generatorTypes.fineTune, 12700, 0),
  new DecodedModulator(650, 0, generatorTypes.pan, 500, 0),
  new DecodedModulator(getModSourceEnum(DEFAULT_ATTENUATION_MOD_CURVE_TYPE, false, true, true, midiControllers.expressionController), 0, generatorTypes.initialAttenuation, DEFAULT_ATTENUATION_MOD_AMOUNT, 0),
  new DecodedModulator(219, 0, generatorTypes.reverbEffectsSend, 200, 0),
  new DecodedModulator(221, 0, generatorTypes.chorusEffectsSend, 200, 0)
];
var defaultSpessaSynthModulators = [
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.linear, false, false, true, midiControllers.tremoloDepth), 0, generatorTypes.modLfoToVolume, 24, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.convex, true, false, true, midiControllers.attackTime), 0, generatorTypes.attackVolEnv, 6000, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.linear, true, false, true, midiControllers.releaseTime), 0, generatorTypes.releaseVolEnv, 3600, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.linear, true, false, true, midiControllers.decayTime), 0, generatorTypes.decayVolEnv, 3600, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.linear, true, false, true, midiControllers.brightness), 0, generatorTypes.initialFilterFc, 9600, 0),
  new DecodedModulator(defaultResonantModSource, 0, generatorTypes.initialFilterQ, 200, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.switch, false, false, true, midiControllers.softPedal), 0, generatorTypes.initialAttenuation, 50, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.switch, false, false, true, midiControllers.softPedal), 0, generatorTypes.initialFilterFc, -2400, 0),
  new DecodedModulator(getModSourceEnum(modulatorCurveTypes.linear, true, false, true, midiControllers.balance), 0, generatorTypes.pan, 500, 0)
];
var SPESSASYNTH_DEFAULT_MODULATORS = defaultSoundFont2Modulators.concat(defaultSpessaSynthModulators);
var GEN_BYTE_SIZE = 4;
var Generator = class {
  generatorType;
  generatorValue = 0;
  constructor(type, value, validate = true) {
    this.generatorType = type;
    if (value === undefined) {
      throw new Error("No value provided.");
    }
    this.generatorValue = Math.round(value);
    if (validate) {
      const lim = generatorLimits[type];
      if (lim !== undefined) {
        this.generatorValue = Math.max(lim.min, Math.min(lim.max, this.generatorValue));
      }
    }
  }
  write(genData) {
    writeWord(genData, this.generatorType);
    writeWord(genData, this.generatorValue);
  }
  toString() {
    return `${Object.keys(generatorTypes).find((k) => generatorTypes[k] === this.generatorType)}: ${this.generatorValue}`;
  }
};
function addAndClampGenerator(generatorType, presetGens, instrumentGens) {
  const limits = generatorLimits[generatorType] || {
    min: 0,
    max: 32768,
    def: 0
  };
  const presetGen = presetGens.find((g) => g.generatorType === generatorType);
  let presetValue = 0;
  if (presetGen) {
    presetValue = presetGen.generatorValue;
  }
  const instrGen = instrumentGens.find((g) => g.generatorType === generatorType);
  let instValue = limits.def;
  if (instrGen) {
    instValue = instrGen.generatorValue;
  }
  return Math.max(-32767, Math.min(32767, instValue + presetValue));
}
var BAG_BYTE_SIZE = 4;
var BasicZone = class {
  velRange = { min: -1, max: 127 };
  keyRange = { min: -1, max: 127 };
  generators = [];
  modulators = [];
  get hasKeyRange() {
    return this.keyRange.min !== -1;
  }
  get hasVelRange() {
    return this.velRange.min !== -1;
  }
  get fineTuning() {
    const currentCoarse = this.getGenerator(generatorTypes.coarseTune, 0);
    const currentFine = this.getGenerator(generatorTypes.fineTune, 0);
    return currentCoarse * 100 + currentFine;
  }
  set fineTuning(tuningCents) {
    const coarse = Math.trunc(tuningCents / 100);
    const fine = tuningCents % 100;
    this.setGenerator(generatorTypes.coarseTune, coarse);
    this.setGenerator(generatorTypes.fineTune, fine);
  }
  addToGenerator(type, value, validate = true) {
    const genValue = this.getGenerator(type, generatorLimits[type].def);
    this.setGenerator(type, value + genValue, validate);
  }
  setGenerator(type, value, validate = true) {
    switch (type) {
      case generatorTypes.sampleID:
        throw new Error("Use setSample()");
      case generatorTypes.instrument:
        throw new Error("Use setInstrument()");
      case generatorTypes.velRange:
      case generatorTypes.keyRange:
        throw new Error("Set the range manually");
    }
    if (value === null) {
      this.generators = this.generators.filter((g) => g.generatorType !== type);
      return;
    }
    const index = this.generators.findIndex((g) => g.generatorType === type);
    if (index >= 0) {
      this.generators[index] = new Generator(type, value, validate);
    } else {
      this.addGenerators(new Generator(type, value, validate));
    }
  }
  addGenerators(...generators) {
    generators.forEach((g) => {
      switch (g.generatorType) {
        default:
          this.generators.push(g);
          break;
        case generatorTypes.sampleID:
        case generatorTypes.instrument:
          break;
        case generatorTypes.velRange:
          this.velRange.min = g.generatorValue & 127;
          this.velRange.max = g.generatorValue >> 8 & 127;
          break;
        case generatorTypes.keyRange:
          this.keyRange.min = g.generatorValue & 127;
          this.keyRange.max = g.generatorValue >> 8 & 127;
      }
    });
  }
  addModulators(...modulators) {
    this.modulators.push(...modulators);
  }
  getGenerator(generatorType, notFoundValue) {
    return this.generators.find((g) => g.generatorType === generatorType)?.generatorValue ?? notFoundValue;
  }
  copyFrom(zone) {
    this.generators = zone.generators.map((g) => new Generator(g.generatorType, g.generatorValue, false));
    this.modulators = zone.modulators.map(Modulator.copyFrom.bind(Modulator));
    this.velRange = { ...zone.velRange };
    this.keyRange = { ...zone.keyRange };
  }
  getWriteGenerators(bank) {
    const generators = this.generators.filter((g) => g.generatorType !== generatorTypes.sampleID && g.generatorType !== generatorTypes.instrument && g.generatorType !== generatorTypes.keyRange && g.generatorType !== generatorTypes.velRange);
    if (!bank) {
      throw new Error("No bank provided! ");
    }
    if (this.hasVelRange) {
      generators.unshift(new Generator(generatorTypes.velRange, this.velRange.max << 8 | Math.max(this.velRange.min, 0), false));
    }
    if (this.hasKeyRange) {
      generators.unshift(new Generator(generatorTypes.keyRange, this.keyRange.max << 8 | Math.max(this.keyRange.min, 0), false));
    }
    return generators;
  }
};
var BasicGlobalZone = class extends BasicZone {
};
var BasicPresetZone = class extends BasicZone {
  parentPreset;
  constructor(preset, instrument) {
    super();
    this.parentPreset = preset;
    this._instrument = instrument;
    this._instrument.linkTo(this.parentPreset);
  }
  _instrument;
  get instrument() {
    return this._instrument;
  }
  set instrument(instrument) {
    if (this._instrument) {
      this._instrument.unlinkFrom(this.parentPreset);
    }
    this._instrument = instrument;
    this._instrument.linkTo(this.parentPreset);
  }
  getWriteGenerators(bank) {
    const gens = super.getWriteGenerators(bank);
    if (!bank) {
      throw new Error("Instrument ID cannot be determined without the sound bank itself.");
    }
    const instrumentID = bank.instruments.indexOf(this.instrument);
    if (instrumentID < 0) {
      throw new Error(`${this.instrument.name} does not exist in ${bank.soundBankInfo.name}! Cannot write instrument generator.`);
    }
    gens.push(new Generator(generatorTypes.instrument, instrumentID, false));
    return gens;
  }
};
var BasicInstrumentZone = class extends BasicZone {
  parentInstrument;
  useCount;
  constructor(instrument, sample) {
    super();
    this.parentInstrument = instrument;
    this._sample = sample;
    sample.linkTo(this.parentInstrument);
    this.useCount = instrument.useCount;
  }
  _sample;
  get sample() {
    return this._sample;
  }
  set sample(sample) {
    if (this._sample) {
      this._sample.unlinkFrom(this.parentInstrument);
    }
    this._sample = sample;
    sample.linkTo(this.parentInstrument);
  }
  getWriteGenerators(bank) {
    const gens = super.getWriteGenerators(bank);
    const sampleID = bank.samples.indexOf(this.sample);
    if (sampleID < 0) {
      throw new Error(`${this.sample.name} does not exist in ${bank.soundBankInfo.name}! Cannot write sampleID generator.`);
    }
    gens.push(new Generator(generatorTypes.sampleID, sampleID, false));
    return gens;
  }
};
var INST_BYTE_SIZE = 22;
var notGlobalizedTypes = /* @__PURE__ */ new Set([
  generatorTypes.velRange,
  generatorTypes.keyRange,
  generatorTypes.instrument,
  generatorTypes.sampleID,
  generatorTypes.exclusiveClass,
  generatorTypes.endOper,
  generatorTypes.sampleModes,
  generatorTypes.startloopAddrsOffset,
  generatorTypes.startloopAddrsCoarseOffset,
  generatorTypes.endloopAddrsOffset,
  generatorTypes.endloopAddrsCoarseOffset,
  generatorTypes.startAddrsOffset,
  generatorTypes.startAddrsCoarseOffset,
  generatorTypes.endAddrOffset,
  generatorTypes.endAddrsCoarseOffset,
  generatorTypes.initialAttenuation,
  generatorTypes.fineTune,
  generatorTypes.coarseTune,
  generatorTypes.keyNumToVolEnvHold,
  generatorTypes.keyNumToVolEnvDecay,
  generatorTypes.keyNumToModEnvHold,
  generatorTypes.keyNumToModEnvDecay
]);
var BasicInstrument = class {
  name = "";
  zones = [];
  globalZone = new BasicGlobalZone;
  linkedTo = [];
  get useCount() {
    return this.linkedTo.length;
  }
  createZone(sample) {
    const zone = new BasicInstrumentZone(this, sample);
    this.zones.push(zone);
    return zone;
  }
  linkTo(preset) {
    this.linkedTo.push(preset);
    this.zones.forEach((z) => z.useCount++);
  }
  unlinkFrom(preset) {
    const index = this.linkedTo.indexOf(preset);
    if (index < 0) {
      SpessaSynthWarn(`Cannot unlink ${preset.name} from ${this.name}: not linked.`);
      return;
    }
    this.linkedTo.splice(index, 1);
    this.zones.forEach((z) => z.useCount--);
  }
  deleteUnusedZones() {
    this.zones = this.zones.filter((z) => {
      const stays = z.useCount > 0;
      if (!stays) {
        z.sample.unlinkFrom(this);
      }
      return stays;
    });
  }
  delete() {
    if (this.useCount > 0) {
      throw new Error(`Cannot delete an instrument that is used by: ${this.linkedTo.map((p) => p.name).toString()}.`);
    }
    this.zones.forEach((z) => z.sample.unlinkFrom(this));
  }
  deleteZone(index, force = false) {
    const zone = this.zones[index];
    zone.useCount -= 1;
    if (zone.useCount < 1 || force) {
      zone.sample.unlinkFrom(this);
      this.zones.splice(index, 1);
      return true;
    }
    return false;
  }
  globalize() {
    const globalZone = this.globalZone;
    for (let checkedType = 0;checkedType < 58; checkedType++) {
      if (notGlobalizedTypes.has(checkedType)) {
        continue;
      }
      checkedType = checkedType;
      let occurrencesForValues = {};
      const defaultForChecked = generatorLimits[checkedType]?.def || 0;
      occurrencesForValues[defaultForChecked] = 0;
      for (const zone of this.zones) {
        const value = zone.getGenerator(checkedType, undefined);
        if (value !== undefined) {
          if (occurrencesForValues[value] === undefined) {
            occurrencesForValues[value] = 1;
          } else {
            occurrencesForValues[value]++;
          }
        } else {
          occurrencesForValues[defaultForChecked]++;
        }
        let relativeCounterpart;
        switch (checkedType) {
          default:
            continue;
          case generatorTypes.decayVolEnv:
            relativeCounterpart = generatorTypes.keyNumToVolEnvDecay;
            break;
          case generatorTypes.holdVolEnv:
            relativeCounterpart = generatorTypes.keyNumToVolEnvHold;
            break;
          case generatorTypes.decayModEnv:
            relativeCounterpart = generatorTypes.keyNumToModEnvDecay;
            break;
          case generatorTypes.holdModEnv:
            relativeCounterpart = generatorTypes.keyNumToModEnvHold;
        }
        const relative = zone.getGenerator(relativeCounterpart, undefined);
        if (relative !== undefined) {
          occurrencesForValues = {};
          break;
        }
      }
      if (Object.keys(occurrencesForValues).length > 0) {
        const entries = Object.entries(occurrencesForValues);
        const valueToGlobalize = entries.reduce((max, curr) => {
          if (max[1] < curr[1]) {
            return curr;
          }
          return max;
        }, ["0", 0]);
        const targetValue = parseInt(valueToGlobalize[0]);
        if (targetValue !== defaultForChecked) {
          globalZone.setGenerator(checkedType, targetValue, false);
        }
        this.zones.forEach((z) => {
          const genValue = z.getGenerator(checkedType, undefined);
          if (genValue !== undefined) {
            if (genValue === targetValue) {
              z.setGenerator(checkedType, null);
            }
          } else {
            if (targetValue !== defaultForChecked) {
              z.setGenerator(checkedType, defaultForChecked);
            }
          }
        });
      }
    }
    const firstZone = this.zones[0];
    const modulators = firstZone.modulators.map((m) => Modulator.copyFrom(m));
    for (const checkedModulator of modulators) {
      let existsForAllZones = true;
      for (const zone of this.zones) {
        if (!existsForAllZones) {
          continue;
        }
        const mod = zone.modulators.find((m) => Modulator.isIdentical(m, checkedModulator));
        if (!mod) {
          existsForAllZones = false;
        }
      }
      if (existsForAllZones) {
        globalZone.addModulators(Modulator.copyFrom(checkedModulator));
        for (const zone of this.zones) {
          const modulator = zone.modulators.find((m) => Modulator.isIdentical(m, checkedModulator));
          if (!modulator) {
            continue;
          }
          if (modulator.transformAmount === checkedModulator.transformAmount) {
            zone.modulators.splice(zone.modulators.indexOf(modulator), 1);
          }
        }
      }
    }
  }
  write(instData, index) {
    SpessaSynthInfo(`%cWriting ${this.name}...`, consoleColors.info);
    writeBinaryStringIndexed(instData.pdta, this.name.substring(0, 20), 20);
    writeBinaryStringIndexed(instData.xdta, this.name.substring(20), 20);
    writeWord(instData.pdta, index & 65535);
    writeWord(instData.xdta, index >>> 16);
  }
};
var PHDR_BYTE_SIZE = 38;
var BasicPreset = class {
  parentSoundBank;
  name = "";
  program = 0;
  bankMSB = 0;
  bankLSB = 0;
  isGMGSDrum = false;
  zones = [];
  globalZone;
  library = 0;
  genre = 0;
  morphology = 0;
  constructor(parentSoundBank, globalZone = new BasicGlobalZone) {
    this.parentSoundBank = parentSoundBank;
    this.globalZone = globalZone;
  }
  get isXGDrums() {
    return this.parentSoundBank.isXGBank && BankSelectHacks.isXGDrums(this.bankMSB);
  }
  get isAnyDrums() {
    const xg = this.parentSoundBank.isXGBank;
    return this.isGMGSDrum || xg && BankSelectHacks.isXGDrums(this.bankMSB);
  }
  delete() {
    this.zones.forEach((z) => z.instrument?.unlinkFrom(this));
  }
  deleteZone(index) {
    this.zones[index]?.instrument?.unlinkFrom(this);
    this.zones.splice(index, 1);
  }
  createZone(instrument) {
    const z = new BasicPresetZone(this, instrument);
    this.zones.push(z);
    return z;
  }
  preload(keyMin, keyMax) {
    for (let key = keyMin;key < keyMax + 1; key++) {
      for (let velocity = 0;velocity < 128; velocity++) {
        this.getSynthesisData(key, velocity).forEach((synthesisData) => {
          synthesisData.sample.getAudioData();
        });
      }
    }
  }
  matches(preset) {
    return MIDIPatchTools.matches(this, preset);
  }
  getSynthesisData(midiNote, velocity) {
    if (this.zones.length < 1) {
      return [];
    }
    function isInRange(range, number) {
      return number >= range.min && number <= range.max;
    }
    function addUnique(main, adder) {
      main.push(...adder.filter((g) => !main.find((mg) => mg.generatorType === g.generatorType)));
    }
    function addUniqueMods(main, adder) {
      main.push(...adder.filter((m) => !main.find((mm) => Modulator.isIdentical(m, mm))));
    }
    const parsedGeneratorsAndSamples = [];
    const globalPresetGenerators = [
      ...this.globalZone.generators
    ];
    const globalPresetModulators = [
      ...this.globalZone.modulators
    ];
    const globalKeyRange = this.globalZone.keyRange;
    const globalVelRange = this.globalZone.velRange;
    const presetZonesInRange = this.zones.filter((currentZone) => isInRange(currentZone.hasKeyRange ? currentZone.keyRange : globalKeyRange, midiNote) && isInRange(currentZone.hasVelRange ? currentZone.velRange : globalVelRange, velocity));
    presetZonesInRange.forEach((presetZone) => {
      const instrument = presetZone.instrument;
      if (!instrument || instrument.zones.length < 1) {
        return;
      }
      const presetGenerators = presetZone.generators;
      const presetModulators = presetZone.modulators;
      const globalInstrumentGenerators = [
        ...instrument.globalZone.generators
      ];
      const globalInstrumentModulators = [
        ...instrument.globalZone.modulators
      ];
      const globalKeyRange2 = instrument.globalZone.keyRange;
      const globalVelRange2 = instrument.globalZone.velRange;
      const instrumentZonesInRange = instrument.zones.filter((currentZone) => isInRange(currentZone.hasKeyRange ? currentZone.keyRange : globalKeyRange2, midiNote) && isInRange(currentZone.hasVelRange ? currentZone.velRange : globalVelRange2, velocity));
      instrumentZonesInRange.forEach((instrumentZone) => {
        const instrumentGenerators = [...instrumentZone.generators];
        const instrumentModulators = [...instrumentZone.modulators];
        addUnique(presetGenerators, globalPresetGenerators);
        addUnique(instrumentGenerators, globalInstrumentGenerators);
        addUniqueMods(presetModulators, globalPresetModulators);
        addUniqueMods(instrumentModulators, globalInstrumentModulators);
        addUniqueMods(instrumentModulators, this.parentSoundBank.defaultModulators);
        const finalModulatorList = [
          ...instrumentModulators
        ];
        for (const mod of presetModulators) {
          const identicalInstrumentModulator = finalModulatorList.findIndex((m) => Modulator.isIdentical(mod, m));
          if (identicalInstrumentModulator !== -1) {
            finalModulatorList[identicalInstrumentModulator] = finalModulatorList[identicalInstrumentModulator].sumTransform(mod);
          } else {
            finalModulatorList.push(mod);
          }
        }
        if (instrumentZone.sample) {
          parsedGeneratorsAndSamples.push({
            instrumentGenerators,
            presetGenerators,
            modulators: finalModulatorList,
            sample: instrumentZone.sample
          });
        }
      });
    });
    return parsedGeneratorsAndSamples;
  }
  toMIDIString() {
    return MIDIPatchTools.toMIDIString(this);
  }
  toString() {
    return MIDIPatchTools.toNamedMIDIString(this);
  }
  toFlattenedInstrument() {
    const addUnique = (main, adder) => {
      main.push(...adder.filter((g) => !main.find((mg) => mg.generatorType === g.generatorType)));
    };
    const subtractRanges = (r1, r2) => {
      return {
        min: Math.max(r1.min, r2.min),
        max: Math.min(r1.max, r2.max)
      };
    };
    const addUniqueMods = (main, adder) => {
      main.push(...adder.filter((m) => !main.find((mm) => Modulator.isIdentical(m, mm))));
    };
    const outputInstrument = new BasicInstrument;
    outputInstrument.name = this.name;
    const globalPresetGenerators = [];
    const globalPresetModulators = [];
    const globalPresetZone = this.globalZone;
    globalPresetGenerators.push(...globalPresetZone.generators);
    globalPresetModulators.push(...globalPresetZone.modulators);
    const globalPresetKeyRange = globalPresetZone.keyRange;
    const globalPresetVelRange = globalPresetZone.velRange;
    for (const presetZone of this.zones) {
      if (!presetZone.instrument) {
        throw new Error("No instrument in a preset zone.");
      }
      let presetZoneKeyRange = presetZone.keyRange;
      if (!presetZone.hasKeyRange) {
        presetZoneKeyRange = globalPresetKeyRange;
      }
      let presetZoneVelRange = presetZone.velRange;
      if (!presetZone.hasVelRange) {
        presetZoneVelRange = globalPresetVelRange;
      }
      const presetGenerators = presetZone.generators.map((g) => new Generator(g.generatorType, g.generatorValue));
      addUnique(presetGenerators, globalPresetGenerators);
      const presetModulators = [...presetZone.modulators];
      addUniqueMods(presetModulators, globalPresetModulators);
      const instrument = presetZone.instrument;
      const iZones = instrument.zones;
      const globalInstGenerators = [];
      const globalInstModulators = [];
      const globalInstZone = instrument.globalZone;
      globalInstGenerators.push(...globalInstZone.generators);
      globalInstModulators.push(...globalInstZone.modulators);
      const globalInstKeyRange = globalInstZone.keyRange;
      const globalInstVelRange = globalInstZone.velRange;
      for (const instZone of iZones) {
        if (!instZone.sample) {
          throw new Error("No sample in an instrument zone.");
        }
        let instZoneKeyRange = instZone.keyRange;
        if (!instZone.hasKeyRange) {
          instZoneKeyRange = globalInstKeyRange;
        }
        let instZoneVelRange = instZone.velRange;
        if (!instZone.hasVelRange) {
          instZoneVelRange = globalInstVelRange;
        }
        instZoneKeyRange = subtractRanges(instZoneKeyRange, presetZoneKeyRange);
        instZoneVelRange = subtractRanges(instZoneVelRange, presetZoneVelRange);
        if (instZoneKeyRange.max < instZoneKeyRange.min || instZoneVelRange.max < instZoneVelRange.min) {
          continue;
        }
        const instGenerators = instZone.generators.map((g) => new Generator(g.generatorType, g.generatorValue));
        addUnique(instGenerators, globalInstGenerators);
        const instModulators = [...instZone.modulators];
        addUniqueMods(instModulators, globalInstModulators);
        const finalModList = [...instModulators];
        for (const mod of presetModulators) {
          const identicalInstMod = finalModList.findIndex((m) => Modulator.isIdentical(mod, m));
          if (identicalInstMod !== -1) {
            finalModList[identicalInstMod] = finalModList[identicalInstMod].sumTransform(mod);
          } else {
            finalModList.push(mod);
          }
        }
        let finalGenList = instGenerators.map((g) => new Generator(g.generatorType, g.generatorValue));
        for (const gen of presetGenerators) {
          if (gen.generatorType === generatorTypes.velRange || gen.generatorType === generatorTypes.keyRange || gen.generatorType === generatorTypes.instrument || gen.generatorType === generatorTypes.endOper || gen.generatorType === generatorTypes.sampleModes) {
            continue;
          }
          const identicalInstGen = instGenerators.findIndex((g) => g.generatorType === gen.generatorType);
          if (identicalInstGen !== -1) {
            const newAmount = finalGenList[identicalInstGen].generatorValue + gen.generatorValue;
            finalGenList[identicalInstGen] = new Generator(gen.generatorType, newAmount);
          } else {
            const newAmount = generatorLimits[gen.generatorType].def + gen.generatorValue;
            finalGenList.push(new Generator(gen.generatorType, newAmount));
          }
        }
        finalGenList = finalGenList.filter((g) => g.generatorType !== generatorTypes.sampleID && g.generatorType !== generatorTypes.keyRange && g.generatorType !== generatorTypes.velRange && g.generatorType !== generatorTypes.endOper && g.generatorType !== generatorTypes.instrument && g.generatorValue !== generatorLimits[g.generatorType].def);
        const zone = outputInstrument.createZone(instZone.sample);
        zone.keyRange = instZoneKeyRange;
        zone.velRange = instZoneVelRange;
        if (zone.keyRange.min === 0 && zone.keyRange.max === 127) {
          zone.keyRange.min = -1;
        }
        if (zone.velRange.min === 0 && zone.velRange.max === 127) {
          zone.velRange.min = -1;
        }
        zone.addGenerators(...finalGenList);
        zone.addModulators(...finalModList);
      }
    }
    return outputInstrument;
  }
  write(phdrData, index) {
    SpessaSynthInfo(`%cWriting ${this.name}...`, consoleColors.info);
    writeBinaryStringIndexed(phdrData.pdta, this.name.substring(0, 20), 20);
    writeBinaryStringIndexed(phdrData.xdta, this.name.substring(20), 20);
    writeWord(phdrData.pdta, this.program);
    let wBank = this.bankMSB;
    if (this.isGMGSDrum) {
      wBank = 128;
    } else if (this.bankMSB === 0) {
      wBank = this.bankLSB;
    }
    writeWord(phdrData.pdta, wBank);
    phdrData.xdta.currentIndex += 4;
    writeWord(phdrData.pdta, index & 65535);
    writeWord(phdrData.xdta, index >> 16);
    writeDword(phdrData.pdta, this.library);
    writeDword(phdrData.pdta, this.genre);
    writeDword(phdrData.pdta, this.morphology);
    phdrData.xdta.currentIndex += 12;
  }
};
function getAnyDrums(presets, preferXG) {
  let p;
  if (preferXG) {
    p = presets.find((p2) => p2.isXGDrums);
  } else {
    p = presets.find((p2) => p2.isGMGSDrum);
  }
  if (p) {
    return p;
  }
  return presets.find((p2) => p2.isAnyDrums) ?? presets[0];
}
function selectPreset(presets, patch, system) {
  if (presets.length < 1) {
    throw new Error("No presets!");
  }
  if (patch.isGMGSDrum && BankSelectHacks.isSystemXG(system)) {
    patch = {
      ...patch,
      isGMGSDrum: false,
      bankLSB: 0,
      bankMSB: BankSelectHacks.getDrumBank(system)
    };
  }
  const { isGMGSDrum, bankLSB, bankMSB, program } = patch;
  const isXG = BankSelectHacks.isSystemXG(system);
  const xgDrums = BankSelectHacks.isXGDrums(bankMSB) && isXG;
  let p = presets.find((p2) => p2.matches(patch));
  if (p) {
    if (!xgDrums || xgDrums && p.isXGDrums) {
      return p;
    }
  }
  const returnReplacement = (pres) => {
    SpessaSynthInfo(`%cPreset %c${MIDIPatchTools.toMIDIString(patch)}%c not found. (${system}) Replaced with %c${pres.toString()}`, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn, consoleColors.value);
  };
  if (isGMGSDrum) {
    let p2 = presets.find((p3) => p3.isGMGSDrum && p3.program === program);
    if (p2) {
      returnReplacement(p2);
      return p2;
    }
    p2 = presets.find((p3) => p3.isAnyDrums && p3.program === program);
    if (p2) {
      returnReplacement(p2);
      return p2;
    }
    p2 = getAnyDrums(presets, false);
    returnReplacement(p2);
    return p2;
  }
  if (xgDrums) {
    let p2 = presets.find((p3) => p3.program === program && p3.isXGDrums);
    if (p2) {
      returnReplacement(p2);
      return p2;
    }
    p2 = presets.find((p3) => p3.isAnyDrums && p3.program === program);
    if (p2) {
      returnReplacement(p2);
      return p2;
    }
    p2 = getAnyDrums(presets, true);
    returnReplacement(p2);
    return p2;
  }
  const matchingPrograms = presets.filter((p2) => p2.program === program && !p2.isAnyDrums);
  if (matchingPrograms.length < 1) {
    returnReplacement(presets[0]);
    return presets[0];
  }
  if (isXG) {
    p = matchingPrograms.find((p2) => p2.bankLSB === bankLSB);
  } else {
    p = matchingPrograms.find((p2) => p2.bankMSB === bankMSB);
  }
  if (p) {
    returnReplacement(p);
    return p;
  }
  if (bankLSB !== 64 || !isXG) {
    const bank = Math.max(bankMSB, bankLSB);
    p = matchingPrograms.find((p2) => p2.bankLSB === bank || p2.bankMSB === bank);
    if (p) {
      returnReplacement(p);
      return p;
    }
  }
  returnReplacement(matchingPrograms[0]);
  return matchingPrograms[0];
}
var SoundBankManagerPreset = class extends BasicPreset {
  constructor(p, offset) {
    super(p.parentSoundBank, p.globalZone);
    this.bankMSB = BankSelectHacks.addBankOffset(p.bankMSB, offset, p.isXGDrums);
    this.name = p.name;
    this.bankLSB = p.bankLSB;
    this.isGMGSDrum = p.isGMGSDrum;
    this.program = p.program;
    this.genre = p.genre;
    this.morphology = p.morphology;
    this.library = p.library;
    this.zones = p.zones;
  }
};
var SoundBankManager = class {
  soundBankList = [];
  presetListChangeCallback;
  selectablePresetList = [];
  constructor(presetListChangeCallback) {
    this.presetListChangeCallback = presetListChangeCallback;
  }
  _presetList = [];
  get presetList() {
    return [...this._presetList];
  }
  get priorityOrder() {
    return this.soundBankList.map((s) => s.id);
  }
  set priorityOrder(newList) {
    this.soundBankList.sort((a, b) => newList.indexOf(a.id) - newList.indexOf(b.id));
    this.generatePresetList();
  }
  deleteSoundBank(id) {
    if (this.soundBankList.length === 0) {
      SpessaSynthWarn("1 soundbank left. Aborting!");
      return;
    }
    const index = this.soundBankList.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`No sound bank with id "${id}"`);
    }
    this.soundBankList.splice(index, 1);
    this.generatePresetList();
  }
  addSoundBank(font, id, bankOffset = 0) {
    const foundBank = this.soundBankList.find((s) => s.id === id);
    if (foundBank !== undefined) {
      foundBank.soundBank = font;
      foundBank.bankOffset = bankOffset;
    } else {
      this.soundBankList.push({
        id,
        soundBank: font,
        bankOffset
      });
    }
    this.generatePresetList();
  }
  getPreset(patch, system) {
    if (this.soundBankList.length < 1) {
      throw new Error("No sound banks! Did you forget to add one?");
    }
    return selectPreset(this.selectablePresetList, patch, system);
  }
  destroy() {
    this.soundBankList.forEach((s) => {
      s.soundBank.destroySoundBank();
    });
    this.soundBankList = [];
  }
  generatePresetList() {
    const presetList = new Array;
    const addedPresets = /* @__PURE__ */ new Set;
    this.soundBankList.forEach((s) => {
      const bank = s.soundBank;
      const bankOffset = s.bankOffset;
      bank.presets.forEach((p) => {
        const selectablePreset = new SoundBankManagerPreset(p, bankOffset);
        if (!addedPresets.has(selectablePreset.toMIDIString())) {
          addedPresets.add(selectablePreset.toMIDIString());
          presetList.push(selectablePreset);
        }
      });
    });
    presetList.sort(MIDIPatchTools.sorter.bind(MIDIPatchTools));
    this.selectablePresetList = presetList;
    this._presetList = presetList.map((p) => {
      return {
        bankMSB: p.bankMSB,
        bankLSB: p.bankLSB,
        program: p.program,
        isGMGSDrum: p.isGMGSDrum,
        name: p.name,
        isAnyDrums: p.isAnyDrums
      };
    });
    this.presetListChangeCallback();
  }
};
var PAN_SMOOTHING_FACTOR = 0.05;
var REVERB_DIVIDER = 3070;
var CHORUS_DIVIDER = 2000;
var HALF_PI = Math.PI / 2;
var MIN_PAN = -500;
var MAX_PAN = 500;
var PAN_RESOLUTION = MAX_PAN - MIN_PAN;
var panTableLeft = new Float32Array(PAN_RESOLUTION + 1);
var panTableRight = new Float32Array(PAN_RESOLUTION + 1);
for (let pan = MIN_PAN;pan <= MAX_PAN; pan++) {
  const realPan = (pan - MIN_PAN) / PAN_RESOLUTION;
  const tableIndex = pan - MIN_PAN;
  panTableLeft[tableIndex] = Math.cos(HALF_PI * realPan);
  panTableRight[tableIndex] = Math.sin(HALF_PI * realPan);
}
function panAndMixVoice(voice, inputBuffer, outputLeft, outputRight, reverbLeft, reverbRight, chorusLeft, chorusRight, startIndex) {
  if (isNaN(inputBuffer[0])) {
    return;
  }
  let pan;
  if (voice.overridePan) {
    pan = voice.overridePan;
  } else {
    voice.currentPan += (voice.modulatedGenerators[generatorTypes.pan] - voice.currentPan) * this.synthProps.panSmoothingFactor;
    pan = voice.currentPan;
  }
  const gain = this.synthProps.masterParameters.masterGain * this.synthProps.midiVolume * voice.gain;
  const index = ~~(pan + 500);
  const gainLeft = panTableLeft[index] * gain * this.synthProps.panLeft;
  const gainRight = panTableRight[index] * gain * this.synthProps.panRight;
  if (this.synth.enableEffects) {
    const reverbSend = voice.modulatedGenerators[generatorTypes.reverbEffectsSend];
    if (reverbSend > 0) {
      const reverbGain = this.synthProps.masterParameters.reverbGain * this.synthProps.reverbSend * gain * (reverbSend / REVERB_DIVIDER);
      for (let i = 0;i < inputBuffer.length; i++) {
        const idx = i + startIndex;
        reverbLeft[idx] += reverbGain * inputBuffer[i];
        reverbRight[idx] += reverbGain * inputBuffer[i];
      }
    }
    const chorusSend = voice.modulatedGenerators[generatorTypes.chorusEffectsSend];
    if (chorusSend > 0) {
      const chorusGain = this.synthProps.masterParameters.chorusGain * this.synthProps.chorusSend * (chorusSend / CHORUS_DIVIDER);
      const chorusLeftGain = gainLeft * chorusGain;
      const chorusRightGain = gainRight * chorusGain;
      for (let i = 0;i < inputBuffer.length; i++) {
        const idx = i + startIndex;
        chorusLeft[idx] += chorusLeftGain * inputBuffer[i];
        chorusRight[idx] += chorusRightGain * inputBuffer[i];
      }
    }
  }
  if (gainLeft > 0) {
    for (let i = 0;i < inputBuffer.length; i++) {
      outputLeft[i + startIndex] += gainLeft * inputBuffer[i];
    }
  }
  if (gainRight > 0) {
    for (let i = 0;i < inputBuffer.length; i++) {
      outputRight[i + startIndex] += gainRight * inputBuffer[i];
    }
  }
}
var FILTER_SMOOTHING_FACTOR = 0.03;
var LowpassFilter = class _LowpassFilter {
  static cachedCoefficients = [];
  resonanceCb = 0;
  currentInitialFc = 13500;
  a0 = 0;
  a1 = 0;
  a2 = 0;
  a3 = 0;
  a4 = 0;
  x1 = 0;
  x2 = 0;
  y1 = 0;
  y2 = 0;
  lastTargetCutoff = Infinity;
  initialized = false;
  sampleRate;
  maxCutoff;
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.maxCutoff = sampleRate * 0.45;
  }
  static apply(voice, outputBuffer, fcExcursion, smoothingFactor) {
    const initialFc = voice.modulatedGenerators[generatorTypes.initialFilterFc];
    const filter = voice.filter;
    if (!filter.initialized) {
      filter.initialized = true;
      filter.currentInitialFc = initialFc;
    } else {
      filter.currentInitialFc += (initialFc - filter.currentInitialFc) * smoothingFactor;
    }
    const targetCutoff = filter.currentInitialFc + fcExcursion;
    const modulatedResonance = voice.modulatedGenerators[generatorTypes.initialFilterQ];
    if (filter.currentInitialFc > 13499 && targetCutoff > 13499 && modulatedResonance === 0) {
      filter.currentInitialFc = 13500;
      return;
    }
    if (Math.abs(filter.lastTargetCutoff - targetCutoff) > 1 || filter.resonanceCb !== modulatedResonance) {
      filter.lastTargetCutoff = targetCutoff;
      filter.resonanceCb = modulatedResonance;
      _LowpassFilter.calculateCoefficients(filter, targetCutoff);
    }
    for (let i = 0;i < outputBuffer.length; i++) {
      const input = outputBuffer[i];
      const filtered = filter.a0 * input + filter.a1 * filter.x1 + filter.a2 * filter.x2 - filter.a3 * filter.y1 - filter.a4 * filter.y2;
      filter.x2 = filter.x1;
      filter.x1 = input;
      filter.y2 = filter.y1;
      filter.y1 = filtered;
      outputBuffer[i] = filtered;
    }
  }
  static calculateCoefficients(filter, cutoffCents) {
    cutoffCents = ~~cutoffCents;
    const qCb = filter.resonanceCb;
    const cached = _LowpassFilter.cachedCoefficients?.[qCb]?.[cutoffCents];
    if (cached !== undefined) {
      filter.a0 = cached.a0;
      filter.a1 = cached.a1;
      filter.a2 = cached.a2;
      filter.a3 = cached.a3;
      filter.a4 = cached.a4;
      return;
    }
    let cutoffHz = absCentsToHz(cutoffCents);
    cutoffHz = Math.min(cutoffHz, filter.maxCutoff);
    const qDb = qCb / 10;
    const resonanceGain = decibelAttenuationToGain(-(qDb - 3.01));
    const qGain = 1 / Math.sqrt(decibelAttenuationToGain(-qDb));
    const w = 2 * Math.PI * cutoffHz / filter.sampleRate;
    const cosw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * resonanceGain);
    const b1 = (1 - cosw) * qGain;
    const b0 = b1 / 2;
    const b2 = b0;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw;
    const a2 = 1 - alpha;
    const toCache = {
      a0: b0 / a0,
      a1: b1 / a0,
      a2: b2 / a0,
      a3: a1 / a0,
      a4: a2 / a0
    };
    filter.a0 = toCache.a0;
    filter.a1 = toCache.a1;
    filter.a2 = toCache.a2;
    filter.a3 = toCache.a3;
    filter.a4 = toCache.a4;
    _LowpassFilter.cachedCoefficients[qCb] ??= [];
    _LowpassFilter.cachedCoefficients[qCb][cutoffCents] = toCache;
  }
};
var dummy = new LowpassFilter(44100);
dummy.resonanceCb = 0;
for (let i = 1500;i < 13500; i++) {
  dummy.currentInitialFc = i;
  LowpassFilter.calculateCoefficients(dummy, i);
}
var DEFAULT_SYNTH_OPTIONS = {
  enableEventSystem: true,
  initialTime: 0,
  enableEffects: true
};
function getPriority(channel, voice) {
  let priority = 0;
  if (channel.drumChannel) {
    priority += 5;
  }
  if (voice.isInRelease) {
    priority -= 5;
  }
  priority += voice.velocity / 25;
  priority -= voice.volumeEnvelope.state;
  if (voice.isInRelease) {
    priority -= 5;
  }
  priority -= voice.volumeEnvelope.currentAttenuationDb / 50;
  return priority;
}
function killVoicesIntenral(amount) {
  const allVoices = [];
  for (const channel of this.midiChannels) {
    for (const voice of channel.voices) {
      if (!voice.finished) {
        const priority = getPriority(channel, voice);
        allVoices.push({ channel, voice, priority });
      }
    }
  }
  allVoices.sort((a, b) => a.priority - b.priority);
  const voicesToRemove = allVoices.slice(0, amount);
  for (const { channel, voice } of voicesToRemove) {
    const index = channel.voices.indexOf(voice);
    if (index > -1) {
      channel.voices.splice(index, 1);
    }
  }
}
var MODENV_PEAK = 1;
var CONVEX_ATTACK = new Float32Array(1000);
for (let i = 0;i < CONVEX_ATTACK.length; i++) {
  CONVEX_ATTACK[i] = getModulatorCurveValue(0, modulatorCurveTypes.convex, i / 1000);
}
var ModulationEnvelope = class _ModulationEnvelope {
  attackDuration = 0;
  decayDuration = 0;
  holdDuration = 0;
  releaseDuration = 0;
  sustainLevel = 0;
  delayEnd = 0;
  attackEnd = 0;
  holdEnd = 0;
  decayEnd = 0;
  releaseStartLevel = 0;
  currentValue = 0;
  static startRelease(voice) {
    _ModulationEnvelope.recalculate(voice);
  }
  static recalculate(voice) {
    const env = voice.modulationEnvelope;
    if (voice.isInRelease) {
      env.releaseStartLevel = _ModulationEnvelope.getValue(voice, voice.releaseStartTime, true);
    }
    env.sustainLevel = 1 - voice.modulatedGenerators[generatorTypes.sustainModEnv] / 1000;
    env.attackDuration = timecentsToSeconds(voice.modulatedGenerators[generatorTypes.attackModEnv]);
    const decayKeyExcursionCents = (60 - voice.midiNote) * voice.modulatedGenerators[generatorTypes.keyNumToModEnvDecay];
    const decayTime = timecentsToSeconds(voice.modulatedGenerators[generatorTypes.decayModEnv] + decayKeyExcursionCents);
    env.decayDuration = decayTime * (1 - env.sustainLevel);
    const holdKeyExcursionCents = (60 - voice.midiNote) * voice.modulatedGenerators[generatorTypes.keyNumToModEnvHold];
    env.holdDuration = timecentsToSeconds(holdKeyExcursionCents + voice.modulatedGenerators[generatorTypes.holdModEnv]);
    const releaseTime = timecentsToSeconds(Math.max(voice.modulatedGenerators[generatorTypes.releaseModEnv], -7200));
    env.releaseDuration = releaseTime * env.releaseStartLevel;
    env.delayEnd = voice.startTime + timecentsToSeconds(voice.modulatedGenerators[generatorTypes.delayModEnv]);
    env.attackEnd = env.delayEnd + env.attackDuration;
    env.holdEnd = env.attackEnd + env.holdDuration;
    env.decayEnd = env.holdEnd + env.decayDuration;
  }
  static getValue(voice, currentTime, ignoreRelease = false) {
    const env = voice.modulationEnvelope;
    if (voice.isInRelease && !ignoreRelease) {
      if (env.releaseStartLevel === 0) {
        return 0;
      }
      return Math.max(0, (1 - (currentTime - voice.releaseStartTime) / env.releaseDuration) * env.releaseStartLevel);
    }
    if (currentTime < env.delayEnd) {
      env.currentValue = 0;
    } else if (currentTime < env.attackEnd) {
      env.currentValue = CONVEX_ATTACK[~~((1 - (env.attackEnd - currentTime) / env.attackDuration) * 1000)];
    } else if (currentTime < env.holdEnd) {
      env.currentValue = MODENV_PEAK;
    } else if (currentTime < env.decayEnd) {
      env.currentValue = (1 - (env.decayEnd - currentTime) / env.decayDuration) * (env.sustainLevel - MODENV_PEAK) + MODENV_PEAK;
    } else {
      env.currentValue = env.sustainLevel;
    }
    return env.currentValue;
  }
};
var AudioSample = class {
  sampleData;
  playbackStep = 0;
  cursor = 0;
  rootKey = 0;
  loopStart = 0;
  loopEnd = 0;
  end = 0;
  loopingMode = 0;
  isLooping = false;
  constructor(data, playbackStep, cursorStart, rootKey, loopStart, loopEnd, endIndex, loopingMode) {
    this.sampleData = data;
    this.playbackStep = playbackStep;
    this.cursor = cursorStart;
    this.rootKey = rootKey;
    this.loopStart = loopStart;
    this.loopEnd = loopEnd;
    this.end = endIndex;
    this.loopingMode = loopingMode;
    this.isLooping = this.loopingMode === 1 || this.loopingMode === 3;
  }
};
var EXCLUSIVE_CUTOFF_TIME = -2320;
var EXCLUSIVE_MOD_CUTOFF_TIME = -1130;
var Voice = class _Voice {
  sample;
  filter;
  gain = 1;
  generators;
  modulators = [];
  resonanceOffset = 0;
  modulatedGenerators;
  finished = false;
  isInRelease = false;
  velocity = 0;
  midiNote = 0;
  pressure = 0;
  targetKey = 0;
  modulationEnvelope = new ModulationEnvelope;
  volumeEnvelope;
  startTime = 0;
  releaseStartTime = Infinity;
  currentTuningCents = 0;
  currentTuningCalculated = 1;
  currentPan = 0;
  realKey;
  portamentoFromKey = -1;
  portamentoDuration = 0;
  overridePan = 0;
  exclusiveClass = 0;
  constructor(sampleRate, audioSample, midiNote, velocity, currentTime, targetKey, realKey, generators, modulators) {
    this.sample = audioSample;
    this.generators = generators;
    this.exclusiveClass = this.generators[generatorTypes.exclusiveClass];
    this.modulatedGenerators = new Int16Array(generators);
    this.modulators = modulators;
    this.filter = new LowpassFilter(sampleRate);
    this.velocity = velocity;
    this.midiNote = midiNote;
    this.startTime = currentTime;
    this.targetKey = targetKey;
    this.realKey = realKey;
    this.volumeEnvelope = new VolumeEnvelope(sampleRate, generators[generatorTypes.sustainVolEnv]);
  }
  static copyFrom(voice, currentTime, realKey) {
    const sampleToCopy = voice.sample;
    const sample = new AudioSample(sampleToCopy.sampleData, sampleToCopy.playbackStep, sampleToCopy.cursor, sampleToCopy.rootKey, sampleToCopy.loopStart, sampleToCopy.loopEnd, sampleToCopy.end, sampleToCopy.loopingMode);
    return new _Voice(voice.volumeEnvelope.sampleRate, sample, voice.midiNote, voice.velocity, currentTime, voice.targetKey, realKey, new Int16Array(voice.generators), voice.modulators.map(Modulator.copyFrom.bind(Modulator)));
  }
  exclusiveRelease(currentTime) {
    this.release(currentTime, MIN_EXCLUSIVE_LENGTH);
    this.modulatedGenerators[generatorTypes.releaseVolEnv] = EXCLUSIVE_CUTOFF_TIME;
    this.modulatedGenerators[generatorTypes.releaseModEnv] = EXCLUSIVE_MOD_CUTOFF_TIME;
    VolumeEnvelope.recalculate(this);
    ModulationEnvelope.recalculate(this);
  }
  release(currentTime, minNoteLength = MIN_NOTE_LENGTH) {
    this.releaseStartTime = currentTime;
    if (this.releaseStartTime - this.startTime < minNoteLength) {
      this.releaseStartTime = this.startTime + minNoteLength;
    }
  }
};
function getVoicesForPresetInternal(preset, midiNote, velocity, realKey) {
  const cached = this.getCachedVoice(preset, midiNote, velocity);
  if (cached !== undefined) {
    return cached.map((v) => Voice.copyFrom(v, this.currentSynthTime, realKey));
  }
  const voices = preset.getSynthesisData(midiNote, velocity).reduce((voices2, synthesisData) => {
    if (synthesisData.sample.getAudioData() === undefined) {
      SpessaSynthWarn(`Discarding invalid sample: ${synthesisData.sample.name}`);
      return voices2;
    }
    const generators = new Int16Array(GENERATORS_AMOUNT);
    for (let i = 0;i < 60; i++) {
      generators[i] = addAndClampGenerator(i, synthesisData.presetGenerators, synthesisData.instrumentGenerators);
    }
    generators[generatorTypes.initialAttenuation] = Math.floor(generators[generatorTypes.initialAttenuation] * 0.4);
    let rootKey = synthesisData.sample.originalKey;
    if (generators[generatorTypes.overridingRootKey] > -1) {
      rootKey = generators[generatorTypes.overridingRootKey];
    }
    let targetKey = midiNote;
    if (generators[generatorTypes.keyNum] > -1) {
      targetKey = generators[generatorTypes.keyNum];
    }
    const loopStart = synthesisData.sample.loopStart;
    const loopEnd = synthesisData.sample.loopEnd;
    const loopingMode = generators[generatorTypes.sampleModes];
    const sampleData = synthesisData.sample.getAudioData();
    const audioSample = new AudioSample(sampleData, synthesisData.sample.sampleRate / this.sampleRate * Math.pow(2, synthesisData.sample.pitchCorrection / 1200), 0, rootKey, loopStart, loopEnd, Math.floor(sampleData.length) - 1, loopingMode);
    let voiceVelocity = velocity;
    if (generators[generatorTypes.velocity] > -1) {
      voiceVelocity = generators[generatorTypes.velocity];
    }
    voices2.push(new Voice(this.sampleRate, audioSample, midiNote, voiceVelocity, this.currentSynthTime, targetKey, realKey, generators, synthesisData.modulators.map(Modulator.copyFrom.bind(Modulator))));
    return voices2;
  }, []);
  this.setCachedVoice(preset, midiNote, velocity, voices);
  return voices.map((v) => Voice.copyFrom(v, this.currentSynthTime, realKey));
}
function getVoicesInternal(channel, midiNote, velocity, realKey) {
  const channelObject = this.midiChannels[channel];
  const overridePatch = this.keyModifierManager.hasOverridePatch(channel, midiNote);
  let preset = channelObject.preset;
  if (!preset) {
    SpessaSynthWarn(`No preset for channel ${channel}!`);
    return [];
  }
  if (overridePatch) {
    const patch = this.keyModifierManager.getPatch(channel, midiNote);
    preset = this.soundBankManager.getPreset(patch, this.privateProps.masterParameters.midiSystem);
  }
  return this.getVoicesForPreset(preset, midiNote, velocity, realKey);
}
function sysExLogging(syx, channel, value, what, units) {
  SpessaSynthInfo(`%cChannel %c${channel}%c ${what}. %c${value} ${units}%c, with %c${arrayToHexString(syx)}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.value);
}
function sysExNotRecognized(syx, what) {
  SpessaSynthInfo(`%cUnrecognized %c${what} %cSysEx: %c${arrayToHexString(syx)}`, consoleColors.warn, consoleColors.recognized, consoleColors.warn, consoleColors.unrecognized);
}
function getTuning(byte1, byte2, byte3) {
  const midiNote = byte1;
  const fraction = byte2 << 7 | byte3;
  if (byte1 === 127 && byte2 === 127 && byte3 === 127) {
    return { midiNote: -1, centTuning: null };
  }
  return { midiNote, centTuning: fraction * 0.0061 };
}
function handleGM(syx, channelOffset = 0) {
  switch (syx[2]) {
    case 4: {
      let cents;
      switch (syx[3]) {
        case 1: {
          const vol = syx[5] << 7 | syx[4];
          this.setMIDIVolume(vol / 16384);
          SpessaSynthInfo(`%cMaster Volume. Volume: %c${vol}`, consoleColors.info, consoleColors.value);
          break;
        }
        case 2: {
          const balance = syx[5] << 7 | syx[4];
          const pan = (balance - 8192) / 8192;
          this.setMasterParameter("masterPan", pan);
          SpessaSynthInfo(`%cMaster Pan. Pan: %c${pan}`, consoleColors.info, consoleColors.value);
          break;
        }
        case 3: {
          const tuningValue = (syx[5] << 7 | syx[6]) - 8192;
          cents = Math.floor(tuningValue / 81.92);
          this.setMasterTuning(cents);
          SpessaSynthInfo(`%cMaster Fine Tuning. Cents: %c${cents}`, consoleColors.info, consoleColors.value);
          break;
        }
        case 4: {
          const semitones = syx[5] - 64;
          cents = semitones * 100;
          this.setMasterTuning(cents);
          SpessaSynthInfo(`%cMaster Coarse Tuning. Cents: %c${cents}`, consoleColors.info, consoleColors.value);
          break;
        }
        default:
          SpessaSynthInfo(`%cUnrecognized MIDI Device Control Real-time message: %c${arrayToHexString(syx)}`, consoleColors.warn, consoleColors.unrecognized);
      }
      break;
    }
    case 9:
      if (syx[3] === 1) {
        SpessaSynthInfo("%cGM1 system on", consoleColors.info);
        this.resetAllControllers("gm");
      } else if (syx[3] === 3) {
        SpessaSynthInfo("%cGM2 system on", consoleColors.info);
        this.resetAllControllers("gm2");
      } else {
        SpessaSynthInfo("%cGM system off, defaulting to GS", consoleColors.info);
        this.setMasterParameter("midiSystem", "gs");
      }
      break;
    case 8: {
      let currentMessageIndex = 4;
      switch (syx[3]) {
        case 1: {
          const program = syx[currentMessageIndex++];
          const tuningName = readBinaryString(syx, 16, currentMessageIndex);
          currentMessageIndex += 16;
          if (syx.length < 384) {
            SpessaSynthWarn(`The Bulk Tuning Dump is too short! (${syx.length} bytes, at least 384 are expected)`);
            return;
          }
          for (let i = 0;i < 128; i++) {
            this.privateProps.tunings[program][i] = getTuning(syx[currentMessageIndex++], syx[currentMessageIndex++], syx[currentMessageIndex++]);
          }
          SpessaSynthInfo(`%cBulk Tuning Dump %c${tuningName}%c Program: %c${program}`, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.recognized);
          break;
        }
        case 2:
        case 7: {
          if (syx[3] === 7) {
            currentMessageIndex++;
          }
          const tuningProgram = syx[currentMessageIndex++];
          const numberOfChanges = syx[currentMessageIndex++];
          for (let i = 0;i < numberOfChanges; i++) {
            this.privateProps.tunings[tuningProgram][syx[currentMessageIndex++]] = getTuning(syx[currentMessageIndex++], syx[currentMessageIndex++], syx[currentMessageIndex++]);
          }
          SpessaSynthInfo(`%cSingle Note Tuning. Program: %c${tuningProgram}%c Keys affected: %c${numberOfChanges}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
          break;
        }
        case 9:
        case 8: {
          const newOctaveTuning = new Int8Array(12);
          if (syx[3] === 8) {
            for (let i = 0;i < 12; i++) {
              newOctaveTuning[i] = syx[7 + i] - 64;
            }
          } else {
            for (let i = 0;i < 24; i += 2) {
              const tuning = (syx[7 + i] << 7 | syx[8 + i]) - 8192;
              newOctaveTuning[i / 2] = Math.floor(tuning / 81.92);
            }
          }
          if ((syx[4] & 1) === 1) {
            this.midiChannels[14 + channelOffset].setOctaveTuning(newOctaveTuning);
          }
          if ((syx[4] >> 1 & 1) === 1) {
            this.midiChannels[15 + channelOffset].setOctaveTuning(newOctaveTuning);
          }
          for (let i = 0;i < 7; i++) {
            const bit = syx[5] >> i & 1;
            if (bit === 1) {
              this.midiChannels[7 + i + channelOffset].setOctaveTuning(newOctaveTuning);
            }
          }
          for (let i = 0;i < 7; i++) {
            const bit = syx[6] >> i & 1;
            if (bit === 1) {
              this.midiChannels[i + channelOffset].setOctaveTuning(newOctaveTuning);
            }
          }
          SpessaSynthInfo(`%cMIDI Octave Scale ${syx[3] === 8 ? "(1 byte)" : "(2 bytes)"} tuning via Tuning: %c${newOctaveTuning.join(" ")}`, consoleColors.info, consoleColors.value);
          break;
        }
        default:
          sysExNotRecognized(syx, "MIDI Tuning Standard");
          break;
      }
      break;
    }
    default:
      sysExNotRecognized(syx, "General MIDI");
  }
}
function handleGS(syx, channelOffset = 0) {
  if (syx[3] === 18) {
    switch (syx[2]) {
      case 66: {
        const messageValue = syx[7];
        if (syx[4] === 64 || syx[4] === 0 && syx[6] === 127) {
          if ((syx[5] & 16) > 0) {
            const channel = [
              9,
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              10,
              11,
              12,
              13,
              14,
              15
            ][syx[5] & 15] + channelOffset;
            const channelObject = this.midiChannels[channel];
            switch (syx[6]) {
              default:
                sysExNotRecognized(syx, "Roland GS");
                break;
              case 21: {
                const isDrums = messageValue > 0 && syx[5] >> 4 > 0;
                channelObject.setGSDrums(isDrums);
                SpessaSynthInfo(`%cChannel %c${channel}%c ${isDrums ? "is now a drum channel" : "now isn't a drum channel"}%c via: %c${arrayToHexString(syx)}`, consoleColors.info, consoleColors.value, consoleColors.recognized, consoleColors.info, consoleColors.value);
                return;
              }
              case 22: {
                const keyShift = messageValue - 64;
                channelObject.setCustomController(customControllers.channelKeyShift, keyShift);
                sysExLogging(syx, channel, keyShift, "key shift", "keys");
                return;
              }
              case 28: {
                const panPosition = messageValue;
                if (panPosition === 0) {
                  channelObject.randomPan = true;
                  SpessaSynthInfo(`%cRandom pan is set to %cON%c for %c${channel}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.value);
                } else {
                  channelObject.randomPan = false;
                  channelObject.controllerChange(midiControllers.pan, panPosition);
                }
                break;
              }
              case 33:
                channelObject.controllerChange(midiControllers.chorusDepth, messageValue);
                break;
              case 34:
                channelObject.controllerChange(midiControllers.reverbDepth, messageValue);
                break;
              case 64:
              case 65:
              case 66:
              case 67:
              case 68:
              case 69:
              case 70:
              case 71:
              case 72:
              case 73:
              case 74:
              case 75: {
                const tuningBytes = syx.length - 9;
                const newTuning = new Int8Array(12);
                for (let i = 0;i < tuningBytes; i++) {
                  newTuning[i] = syx[i + 7] - 64;
                }
                channelObject.setOctaveTuning(newTuning);
                const cents = messageValue - 64;
                sysExLogging(syx, channel, newTuning.join(" "), "octave scale tuning", "cents");
                channelObject.setTuning(cents);
                break;
              }
            }
            return;
          } else if ((syx[5] & 32) > 0) {
            const channel = [
              9,
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              10,
              11,
              12,
              13,
              14,
              15
            ][syx[5] & 15] + channelOffset;
            const channelObject = this.midiChannels[channel];
            const centeredValue = messageValue - 64;
            const normalizedValue = centeredValue / 64;
            const normalizedNotCentered = messageValue / 128;
            const setupReceivers = (source, sourceName, bipolar = false) => {
              switch (syx[6] & 15) {
                case 0:
                  if (source === NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel) {
                    channelObject.controllerChange(midiControllers.registeredParameterMSB, 0);
                    channelObject.controllerChange(midiControllers.registeredParameterLSB, 0);
                    channelObject.controllerChange(midiControllers.dataEntryMSB, Math.floor(centeredValue));
                  } else {
                    channelObject.sysExModulators.setModulator(source, generatorTypes.fineTune, centeredValue * 100, bipolar);
                    sysExLogging(syx, channel, centeredValue, `${sourceName} pitch control`, "semitones");
                  }
                  break;
                case 1:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.initialFilterFc, normalizedValue * 9600, bipolar);
                  sysExLogging(syx, channel, normalizedValue * 9600, `${sourceName} pitch control`, "cents");
                  break;
                case 2:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.initialAttenuation, normalizedValue * 960, bipolar);
                  sysExLogging(syx, channel, normalizedValue * 960, `${sourceName} amplitude`, "cB");
                  break;
                case 4:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.vibLfoToPitch, normalizedNotCentered * 600, bipolar);
                  sysExLogging(syx, channel, normalizedNotCentered * 600, `${sourceName} LFO1 pitch depth`, "cents");
                  break;
                case 5:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.vibLfoToFilterFc, normalizedNotCentered * 2400, bipolar);
                  sysExLogging(syx, channel, normalizedNotCentered * 2400, `${sourceName} LFO1 filter depth`, "cents");
                  break;
                case 6:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.vibLfoToVolume, normalizedValue * 960, bipolar);
                  sysExLogging(syx, channel, normalizedValue * 960, `${sourceName} LFO1 amplitude depth`, "cB");
                  break;
                case 8:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.modLfoToPitch, normalizedNotCentered * 600, bipolar);
                  sysExLogging(syx, channel, normalizedNotCentered * 600, `${sourceName} LFO2 pitch depth`, "cents");
                  break;
                case 9:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.modLfoToFilterFc, normalizedNotCentered * 2400, bipolar);
                  sysExLogging(syx, channel, normalizedNotCentered * 2400, `${sourceName} LFO2 filter depth`, "cents");
                  break;
                case 10:
                  channelObject.sysExModulators.setModulator(source, generatorTypes.modLfoToVolume, normalizedValue * 960, bipolar);
                  sysExLogging(syx, channel, normalizedValue * 960, `${sourceName} LFO2 amplitude depth`, "cB");
                  break;
              }
            };
            switch (syx[6] & 240) {
              default:
                sysExNotRecognized(syx, "Roland GS");
                break;
              case 0:
                setupReceivers(midiControllers.modulationWheel, "mod wheel");
                break;
              case 16:
                setupReceivers(NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel, "pitch wheel", true);
                break;
              case 32:
                setupReceivers(NON_CC_INDEX_OFFSET + modulatorSources.channelPressure, "channel pressure");
                break;
              case 48:
                setupReceivers(NON_CC_INDEX_OFFSET + modulatorSources.polyPressure, "poly pressure");
                break;
            }
            return;
          } else if (syx[5] === 0) {
            switch (syx[6]) {
              default:
                sysExNotRecognized(syx, "Roland GS");
                break;
              case 127:
                if (messageValue === 0) {
                  SpessaSynthInfo("%cGS Reset received!", consoleColors.info);
                  this.resetAllControllers("gs");
                } else if (messageValue === 127) {
                  SpessaSynthInfo("%cGS system off, switching to GM", consoleColors.info);
                  this.resetAllControllers("gm");
                }
                break;
              case 6:
                SpessaSynthInfo(`%cRoland GS Master Pan set to: %c${messageValue}%c with: %c${arrayToHexString(syx)}`, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.value);
                this.setMasterParameter("masterPan", (messageValue - 64) / 64);
                break;
              case 4:
                SpessaSynthInfo(`%cRoland GS Master Volume set to: %c${messageValue}%c with: %c${arrayToHexString(syx)}`, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.value);
                this.setMIDIVolume(messageValue / 127);
                break;
              case 5: {
                const transpose = messageValue - 64;
                SpessaSynthInfo(`%cRoland GS Master Key-Shift set to: %c${transpose}%c with: %c${arrayToHexString(syx)}`, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.value);
                this.setMasterTuning(transpose * 100);
                break;
              }
            }
            return;
          } else if (syx[5] === 1) {
            switch (syx[6]) {
              default:
                sysExNotRecognized(syx, "Roland GS");
                break;
              case 0: {
                const patchName = readBinaryString(syx, 16, 7);
                SpessaSynthInfo(`%cGS Patch name: %c${patchName}`, consoleColors.info, consoleColors.value);
                break;
              }
              case 51:
                SpessaSynthInfo(`%cGS Reverb level: %c${messageValue}`, consoleColors.info, consoleColors.value);
                this.privateProps.reverbSend = messageValue / 64;
                break;
              case 48:
              case 49:
              case 50:
              case 52:
              case 53:
              case 55:
                SpessaSynthInfo(`%cUnsupported GS Reverb Parameter: %c${syx[6].toString(16)}`, consoleColors.warn, consoleColors.unrecognized);
                break;
              case 58:
                SpessaSynthInfo(`%cGS Chorus level: %c${messageValue}`, consoleColors.info, consoleColors.value);
                this.privateProps.chorusSend = messageValue / 64;
                break;
              case 56:
              case 57:
              case 59:
              case 60:
              case 61:
              case 62:
              case 63:
              case 64:
                SpessaSynthInfo(`%cUnsupported GS Chorus Parameter: %c${syx[6].toString(16)}`, consoleColors.warn, consoleColors.unrecognized);
                break;
            }
          }
        } else {
          sysExNotRecognized(syx, "Roland GS");
        }
        return;
      }
      case 69: {
        if (syx[4] === 16) {
          if (syx[5] === 0) {
            this.privateProps.callEvent("synthDisplay", Array.from(syx));
          } else if (syx[5] === 1) {
            this.privateProps.callEvent("synthDisplay", Array.from(syx));
          } else {
            sysExNotRecognized(syx, "Roland GS");
          }
        }
        return;
      }
      case 22:
        if (syx[4] === 16) {
          this.setMIDIVolume(syx[7] / 100);
          SpessaSynthInfo(`%cRoland Master Volume control set to: %c${syx[7]}%c via: %c${arrayToHexString(syx)}`, consoleColors.info, consoleColors.value, consoleColors.info, consoleColors.value);
          return;
        }
    }
  } else {
    sysExNotRecognized(syx, "Roland GS");
    return;
  }
}
function handleXG(syx, channelOffset = 0) {
  if (syx[2] === 76) {
    const a1 = syx[3];
    const a2 = syx[4];
    if (a1 === 0 && a2 === 0) {
      switch (syx[5]) {
        case 0:
          {
            const tune = (syx[6] & 15) << 12 | (syx[7] & 15) << 8 | (syx[8] & 15) << 4 | syx[9] & 15;
            const cents = (tune - 1024) / 10;
            this.setMasterTuning(cents);
            SpessaSynthInfo(`%cXG master tune. Cents: %c${cents}`, consoleColors.info, consoleColors.recognized);
          }
          break;
        case 4: {
          const vol = syx[6];
          this.setMIDIVolume(vol / 127);
          SpessaSynthInfo(`%cXG master volume. Volume: %c${vol}`, consoleColors.info, consoleColors.recognized);
          break;
        }
        case 5: {
          const vol = 127 - syx[6];
          this.setMIDIVolume(vol / 127);
          SpessaSynthInfo(`%cXG master attenuation. Volume: %c${vol}`, consoleColors.info, consoleColors.recognized);
          break;
        }
        case 6: {
          const transpose = syx[6] - 64;
          this.setMasterParameter("transposition", transpose);
          SpessaSynthInfo(`%cXG master transpose. Volume: %c${transpose}`, consoleColors.info, consoleColors.recognized);
          break;
        }
        case 126:
          SpessaSynthInfo("%cXG system on", consoleColors.info);
          this.resetAllControllers("xg");
          break;
      }
    } else if (a1 === 2 && a2 === 1) {
      let effectType;
      const effect = syx[5];
      if (effect <= 21)
        effectType = "Reverb";
      else if (effect <= 35)
        effectType = "Chorus";
      else
        effectType = "Variation";
      SpessaSynthInfo(`%cUnsupported XG ${effectType} Parameter: %c${effect.toString(16)}`, consoleColors.warn, consoleColors.unrecognized);
    } else if (a1 === 8) {
      if (!BankSelectHacks.isSystemXG(this.privateProps.masterParameters.midiSystem)) {
        return;
      }
      const channel = a2 + channelOffset;
      if (channel >= this.midiChannels.length) {
        return;
      }
      const channelObject = this.midiChannels[channel];
      const value = syx[6];
      switch (syx[5]) {
        case 1:
          channelObject.controllerChange(midiControllers.bankSelect, value);
          break;
        case 2:
          channelObject.controllerChange(midiControllers.bankSelectLSB, value);
          break;
        case 3:
          channelObject.programChange(value);
          break;
        case 7:
          channelObject.setDrums(value != 0);
          break;
        case 8: {
          if (channelObject.drumChannel) {
            break;
          }
          channelObject.setCustomController(customControllers.channelKeyShift, value - 64);
          break;
        }
        case 11:
          channelObject.controllerChange(midiControllers.mainVolume, value);
          break;
        case 14: {
          const pan = value;
          if (pan === 0) {
            channelObject.randomPan = true;
            SpessaSynthInfo(`%cRandom pan is set to %cON%c for %c${channel}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.value);
          } else {
            channelObject.controllerChange(midiControllers.pan, pan);
          }
          break;
        }
        case 17:
          channelObject.controllerChange(midiControllers.mainVolume, value);
          break;
        case 18:
          channelObject.controllerChange(midiControllers.chorusDepth, value);
          break;
        case 19:
          channelObject.controllerChange(midiControllers.reverbDepth, value);
          break;
        case 21:
          channelObject.controllerChange(midiControllers.vibratoRate, value);
          break;
        case 22:
          channelObject.controllerChange(midiControllers.vibratoDepth, value);
          break;
        case 23:
          channelObject.controllerChange(midiControllers.vibratoDelay, value);
          break;
        case 24:
          channelObject.controllerChange(midiControllers.brightness, value);
          break;
        case 25:
          channelObject.controllerChange(midiControllers.filterResonance, value);
          break;
        case 26:
          channelObject.controllerChange(midiControllers.attackTime, value);
          break;
        case 27:
          channelObject.controllerChange(midiControllers.decayTime, value);
          break;
        case 28:
          channelObject.controllerChange(midiControllers.releaseTime, value);
          break;
        default:
          SpessaSynthInfo(`%cUnsupported Yamaha XG Part Setup: %c${syx[5].toString(16).toUpperCase()}%c for channel ${channel}`, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn);
      }
    } else if (a1 === 6 && a2 === 0) {
      this.privateProps.callEvent("synthDisplay", Array.from(syx));
    } else if (BankSelectHacks.isSystemXG(this.privateProps.masterParameters.midiSystem)) {
      sysExNotRecognized(syx, "Yamaha XG");
    }
  } else {
    sysExNotRecognized(syx, "Yamaha");
  }
}
function systemExclusiveInternal(syx, channelOffset = 0) {
  const manufacturer = syx[0];
  if (this.privateProps.masterParameters.deviceID !== ALL_CHANNELS_OR_DIFFERENT_ACTION && syx[1] !== 127) {
    if (this.privateProps.masterParameters.deviceID !== syx[1]) {
      return;
    }
  }
  switch (manufacturer) {
    default:
      SpessaSynthInfo(`%cUnrecognized SysEx: %c${arrayToHexString(syx)} (unknown manufacturer)`, consoleColors.warn, consoleColors.unrecognized);
      break;
    case 126:
    case 127:
      handleGM.call(this, syx, channelOffset);
      break;
    case 65:
      handleGS.call(this, syx, channelOffset);
      break;
    case 67:
      handleXG.call(this, syx, channelOffset);
      break;
  }
}
var ChannelSnapshot = class _ChannelSnapshot {
  patch;
  lockPreset;
  lockedSystem;
  midiControllers;
  lockedControllers;
  customControllers;
  lockVibrato;
  channelVibrato;
  channelTransposeKeyShift;
  channelOctaveTuning;
  isMuted;
  drumChannel;
  channelNumber;
  constructor(patch, lockPreset, lockedSystem, midiControllers2, lockedControllers, customControllers2, lockVibrato, channelVibrato, channelTransposeKeyShift, channelOctaveTuning, isMuted, drumChannel, channelNumber) {
    this.patch = patch;
    this.lockPreset = lockPreset;
    this.lockedSystem = lockedSystem;
    this.midiControllers = midiControllers2;
    this.lockedControllers = lockedControllers;
    this.customControllers = customControllers2;
    this.lockVibrato = lockVibrato;
    this.channelVibrato = channelVibrato;
    this.channelTransposeKeyShift = channelTransposeKeyShift;
    this.channelOctaveTuning = channelOctaveTuning;
    this.isMuted = isMuted;
    this.drumChannel = drumChannel;
    this.channelNumber = channelNumber;
  }
  static copyFrom(snapshot) {
    return new _ChannelSnapshot({ ...snapshot.patch }, snapshot.lockPreset, snapshot.lockedSystem, snapshot.midiControllers.slice(), [...snapshot.lockedControllers], snapshot.customControllers.slice(), snapshot.lockVibrato, { ...snapshot.channelVibrato }, snapshot.channelTransposeKeyShift, snapshot.channelOctaveTuning, snapshot.isMuted, snapshot.drumChannel, snapshot.channelNumber);
  }
  static create(spessaSynthProcessor, channelNumber) {
    const channelObject = spessaSynthProcessor.midiChannels[channelNumber];
    return new _ChannelSnapshot({
      ...channelObject.patch,
      name: channelObject?.preset?.name ?? "undefined"
    }, channelObject.lockPreset, channelObject.lockedSystem, channelObject.midiControllers.slice(), [...channelObject.lockedControllers], channelObject.customControllers.slice(), channelObject.lockGSNRPNParams, { ...channelObject.channelVibrato }, channelObject.channelTransposeKeyShift, channelObject.channelOctaveTuning.slice(), channelObject.isMuted, channelObject.drumChannel, channelNumber);
  }
  apply(spessaSynthProcessor) {
    const channelObject = spessaSynthProcessor.midiChannels[this.channelNumber];
    channelObject.muteChannel(this.isMuted);
    channelObject.setDrums(this.drumChannel);
    channelObject.midiControllers.set(this.midiControllers);
    channelObject.lockedControllers = this.lockedControllers;
    channelObject.customControllers.set(this.customControllers);
    channelObject.updateChannelTuning();
    channelObject.channelVibrato = this.channelVibrato;
    channelObject.lockGSNRPNParams = this.lockVibrato;
    channelObject.channelTransposeKeyShift = this.channelTransposeKeyShift;
    channelObject.channelOctaveTuning = this.channelOctaveTuning;
    channelObject.setPresetLock(false);
    channelObject.setPatch(this.patch);
    channelObject.setPresetLock(this.lockPreset);
    channelObject.lockedSystem = this.lockedSystem;
  }
};
var KeyModifierManager = class {
  keyMappings = [];
  addMapping(channel, midiNote, mapping) {
    this.keyMappings[channel] ??= [];
    this.keyMappings[channel][midiNote] = mapping;
  }
  deleteMapping(channel, midiNote) {
    if (this.keyMappings[channel]?.[midiNote] === undefined) {
      return;
    }
    this.keyMappings[channel][midiNote] = undefined;
  }
  clearMappings() {
    this.keyMappings = [];
  }
  setMappings(mappings) {
    this.keyMappings = mappings;
  }
  getMappings() {
    return this.keyMappings;
  }
  getVelocity(channel, midiNote) {
    return this.keyMappings[channel]?.[midiNote]?.velocity ?? -1;
  }
  getGain(channel, midiNote) {
    return this.keyMappings[channel]?.[midiNote]?.gain ?? 1;
  }
  hasOverridePatch(channel, midiNote) {
    const bank = this.keyMappings[channel]?.[midiNote]?.patch?.bankMSB;
    return bank !== undefined && bank >= 0;
  }
  getPatch(channel, midiNote) {
    const modifier = this.keyMappings[channel]?.[midiNote];
    if (modifier) {
      return modifier.patch;
    }
    throw new Error("No modifier.");
  }
};
var SynthesizerSnapshot = class _SynthesizerSnapshot {
  channelSnapshots;
  keyMappings;
  masterParameters;
  constructor(channelSnapshots, masterParameters, keyMappings) {
    this.channelSnapshots = channelSnapshots;
    this.masterParameters = masterParameters;
    this.keyMappings = keyMappings;
  }
  static create(processor) {
    const channelSnapshots = processor.midiChannels.map((_, i) => ChannelSnapshot.create(processor, i));
    return new _SynthesizerSnapshot(channelSnapshots, processor.getAllMasterParameters(), processor.keyModifierManager.getMappings());
  }
  static copyFrom(snapshot) {
    return new _SynthesizerSnapshot(snapshot.channelSnapshots.map((s) => ChannelSnapshot.copyFrom(s)), { ...snapshot.masterParameters }, [...snapshot.keyMappings]);
  }
  apply(processor) {
    const entries = Object.entries(this.masterParameters);
    entries.forEach(([parameter, value]) => {
      processor.setMasterParameter(parameter, value);
    });
    processor.keyModifierManager.setMappings(this.keyMappings);
    while (processor.midiChannels.length < this.channelSnapshots.length) {
      processor.createMIDIChannel();
    }
    this.channelSnapshots.forEach((channelSnapshot) => {
      channelSnapshot.apply(processor);
    });
  }
};
var DEFAULT_MASTER_PARAMETERS = {
  masterGain: SYNTHESIZER_GAIN,
  masterPan: 0,
  voiceCap: VOICE_CAP,
  interpolationType: interpolationTypes.hermite,
  midiSystem: DEFAULT_SYNTH_MODE,
  monophonicRetriggerMode: false,
  reverbGain: 1,
  chorusGain: 1,
  blackMIDIMode: false,
  transposition: 0,
  deviceID: ALL_CHANNELS_OR_DIFFERENT_ACTION
};
var ProtectedSynthValues = class {
  tunings = [];
  masterParameters = DEFAULT_MASTER_PARAMETERS;
  midiVolume = 1;
  reverbSend = 1;
  chorusSend = 1;
  panLeft = 0.5;
  panRight = 0.5;
  defaultPreset;
  drumPreset;
  volumeEnvelopeSmoothingFactor;
  panSmoothingFactor;
  filterSmoothingFactor;
  eventCallbackHandler;
  getVoices;
  voiceKilling;
  cachedVoices = [];
  constructor(eventCallbackHandler, getVoices, voiceKillingFunction, volumeEnvelopeSmoothingFactor, panSmoothingFactor, filterSmoothingFactor) {
    this.eventCallbackHandler = eventCallbackHandler;
    this.getVoices = getVoices;
    this.voiceKilling = voiceKillingFunction;
    this.volumeEnvelopeSmoothingFactor = volumeEnvelopeSmoothingFactor;
    this.panSmoothingFactor = panSmoothingFactor;
    this.filterSmoothingFactor = filterSmoothingFactor;
    for (let i = 0;i < 128; i++) {
      this.tunings.push([]);
    }
  }
  callEvent(eventName, eventData) {
    this.eventCallbackHandler(eventName, eventData);
  }
};
function getLFOValue(startTime, frequency, currentTime) {
  if (currentTime < startTime) {
    return 0;
  }
  const xVal = (currentTime - startTime) / (1 / frequency) + 0.25;
  return Math.abs(xVal - ~~(xVal + 0.5)) * 4 - 1;
}
var WavetableOscillator = class _WavetableOscillator {
  static getSample(voice, outputBuffer, interpolation) {
    const step = voice.currentTuningCalculated * voice.sample.playbackStep;
    if (step === 1) {
      _WavetableOscillator.getSampleNearest(voice, outputBuffer, step);
      return;
    }
    switch (interpolation) {
      case interpolationTypes.hermite:
        this.getSampleHermite(voice, outputBuffer, step);
        return;
      case interpolationTypes.linear:
      default:
        this.getSampleLinear(voice, outputBuffer, step);
        return;
      case interpolationTypes.nearestNeighbor:
        _WavetableOscillator.getSampleNearest(voice, outputBuffer, step);
        return;
    }
  }
  static getSampleLinear(voice, outputBuffer, step) {
    const sample = voice.sample;
    let cur = sample.cursor;
    const sampleData = sample.sampleData;
    if (sample.isLooping) {
      const loopLength = sample.loopEnd - sample.loopStart;
      for (let i = 0;i < outputBuffer.length; i++) {
        while (cur >= sample.loopEnd) {
          cur -= loopLength;
        }
        const floor = ~~cur;
        let ceil = floor + 1;
        while (ceil >= sample.loopEnd) {
          ceil -= loopLength;
        }
        const fraction = cur - floor;
        const upper = sampleData[ceil];
        const lower = sampleData[floor];
        outputBuffer[i] = lower + (upper - lower) * fraction;
        cur += step;
      }
    } else {
      for (let i = 0;i < outputBuffer.length; i++) {
        const floor = ~~cur;
        const ceil = floor + 1;
        if (ceil >= sample.end) {
          voice.finished = true;
          return;
        }
        const fraction = cur - floor;
        const upper = sampleData[ceil];
        const lower = sampleData[floor];
        outputBuffer[i] = lower + (upper - lower) * fraction;
        cur += step;
      }
    }
    voice.sample.cursor = cur;
  }
  static getSampleNearest(voice, outputBuffer, step) {
    const sample = voice.sample;
    let cur = sample.cursor;
    const sampleData = sample.sampleData;
    if (sample.isLooping) {
      const loopLength = sample.loopEnd - sample.loopStart;
      for (let i = 0;i < outputBuffer.length; i++) {
        while (cur >= sample.loopEnd) {
          cur -= loopLength;
        }
        let ceil = ~~cur + 1;
        while (ceil >= sample.loopEnd) {
          ceil -= loopLength;
        }
        outputBuffer[i] = sampleData[ceil];
        cur += step;
      }
    } else {
      for (let i = 0;i < outputBuffer.length; i++) {
        const ceil = ~~cur + 1;
        if (ceil >= sample.end) {
          voice.finished = true;
          return;
        }
        outputBuffer[i] = sampleData[ceil];
        cur += step;
      }
    }
    sample.cursor = cur;
  }
  static getSampleHermite(voice, outputBuffer, step) {
    const sample = voice.sample;
    let cur = sample.cursor;
    const sampleData = sample.sampleData;
    if (sample.isLooping) {
      const loopLength = sample.loopEnd - sample.loopStart;
      for (let i = 0;i < outputBuffer.length; i++) {
        while (cur >= sample.loopEnd) {
          cur -= loopLength;
        }
        const y0 = ~~cur;
        let y1 = y0 + 1;
        let y2 = y0 + 2;
        let y3 = y0 + 3;
        const t = cur - y0;
        if (y1 >= sample.loopEnd) {
          y1 -= loopLength;
        }
        if (y2 >= sample.loopEnd) {
          y2 -= loopLength;
        }
        if (y3 >= sample.loopEnd) {
          y3 -= loopLength;
        }
        const xm1 = sampleData[y0];
        const x0 = sampleData[y1];
        const x1 = sampleData[y2];
        const x2 = sampleData[y3];
        const c = (x1 - xm1) * 0.5;
        const v = x0 - x1;
        const w = c + v;
        const a = w + v + (x2 - x0) * 0.5;
        const b = w + a;
        outputBuffer[i] = ((a * t - b) * t + c) * t + x0;
        cur += step;
      }
    } else {
      for (let i = 0;i < outputBuffer.length; i++) {
        const y0 = ~~cur;
        const y1 = y0 + 1;
        const y2 = y0 + 2;
        const y3 = y0 + 3;
        const t = cur - y0;
        if (y1 >= sample.end || y2 >= sample.end || y3 >= sample.end) {
          voice.finished = true;
          return;
        }
        const xm1 = sampleData[y0];
        const x0 = sampleData[y1];
        const x1 = sampleData[y2];
        const x2 = sampleData[y3];
        const c = (x1 - xm1) * 0.5;
        const v = x0 - x1;
        const w = c + v;
        const a = w + v + (x2 - x0) * 0.5;
        const b = w + a;
        outputBuffer[i] = ((a * t - b) * t + c) * t + x0;
        cur += step;
      }
    }
    voice.sample.cursor = cur;
  }
};
function renderVoice(voice, timeNow, outputLeft, outputRight, reverbOutputLeft, reverbOutputRight, chorusOutputLeft, chorusOutputRight, startIndex, sampleCount) {
  if (!voice.isInRelease) {
    if (timeNow >= voice.releaseStartTime) {
      voice.isInRelease = true;
      VolumeEnvelope.startRelease(voice);
      ModulationEnvelope.startRelease(voice);
      if (voice.sample.loopingMode === 3) {
        voice.sample.isLooping = false;
      }
    }
  }
  if (voice.modulatedGenerators[generatorTypes.initialAttenuation] > 2500) {
    if (voice.isInRelease) {
      voice.finished = true;
    }
    return voice.finished;
  }
  let targetKey = voice.targetKey;
  let cents = voice.modulatedGenerators[generatorTypes.fineTune] + this.channelOctaveTuning[voice.midiNote] + this.channelTuningCents;
  let semitones = voice.modulatedGenerators[generatorTypes.coarseTune];
  const tuning = this.synthProps.tunings[this.preset?.program ?? 0]?.[voice.realKey];
  if (tuning?.centTuning) {
    targetKey = tuning.midiNote;
    cents += tuning.centTuning;
  }
  if (voice.portamentoFromKey > -1) {
    const elapsed = Math.min((timeNow - voice.startTime) / voice.portamentoDuration, 1);
    const diff = targetKey - voice.portamentoFromKey;
    semitones -= diff * (1 - elapsed);
  }
  cents += (targetKey - voice.sample.rootKey) * voice.modulatedGenerators[generatorTypes.scaleTuning];
  let lowpassExcursion = 0;
  let volumeExcursionCentibels = 0;
  const vibPitchDepth = voice.modulatedGenerators[generatorTypes.vibLfoToPitch];
  const vibVolDepth = voice.modulatedGenerators[generatorTypes.vibLfoToVolume];
  const vibFilterDepth = voice.modulatedGenerators[generatorTypes.vibLfoToFilterFc];
  if (vibPitchDepth !== 0 || vibVolDepth !== 0 || vibFilterDepth !== 0) {
    const vibStart = voice.startTime + timecentsToSeconds(voice.modulatedGenerators[generatorTypes.delayVibLFO]);
    const vibFreqHz = absCentsToHz(voice.modulatedGenerators[generatorTypes.freqVibLFO]);
    const vibLfoValue = getLFOValue(vibStart, vibFreqHz, timeNow);
    cents += vibLfoValue * (vibPitchDepth * this.customControllers[customControllers.modulationMultiplier]);
    volumeExcursionCentibels += -vibLfoValue * vibVolDepth;
    lowpassExcursion += vibLfoValue * vibFilterDepth;
  }
  const modPitchDepth = voice.modulatedGenerators[generatorTypes.modLfoToPitch];
  const modVolDepth = voice.modulatedGenerators[generatorTypes.modLfoToVolume];
  const modFilterDepth = voice.modulatedGenerators[generatorTypes.modLfoToFilterFc];
  if (modPitchDepth !== 0 || modFilterDepth !== 0 || modVolDepth !== 0) {
    const modStart = voice.startTime + timecentsToSeconds(voice.modulatedGenerators[generatorTypes.delayModLFO]);
    const modFreqHz = absCentsToHz(voice.modulatedGenerators[generatorTypes.freqModLFO]);
    const modLfoValue = getLFOValue(modStart, modFreqHz, timeNow);
    cents += modLfoValue * (modPitchDepth * this.customControllers[customControllers.modulationMultiplier]);
    volumeExcursionCentibels += -modLfoValue * modVolDepth;
    lowpassExcursion += modLfoValue * modFilterDepth;
  }
  if (this.midiControllers[midiControllers.modulationWheel] == 0 && this.channelVibrato.depth > 0) {
    cents += getLFOValue(voice.startTime + this.channelVibrato.delay, this.channelVibrato.rate, timeNow) * this.channelVibrato.depth;
  }
  const modEnvPitchDepth = voice.modulatedGenerators[generatorTypes.modEnvToPitch];
  const modEnvFilterDepth = voice.modulatedGenerators[generatorTypes.modEnvToFilterFc];
  if (modEnvFilterDepth !== 0 || modEnvPitchDepth !== 0) {
    const modEnv = ModulationEnvelope.getValue(voice, timeNow);
    lowpassExcursion += modEnv * modEnvFilterDepth;
    cents += modEnv * modEnvPitchDepth;
  }
  volumeExcursionCentibels -= voice.resonanceOffset;
  const centsTotal = ~~(cents + semitones * 100);
  if (centsTotal !== voice.currentTuningCents) {
    voice.currentTuningCents = centsTotal;
    voice.currentTuningCalculated = Math.pow(2, centsTotal / 1200);
  }
  const bufferOut = new Float32Array(sampleCount);
  if (voice.sample.loopingMode === 2 && !voice.isInRelease) {
    VolumeEnvelope.apply(voice, bufferOut, volumeExcursionCentibels, this.synthProps.volumeEnvelopeSmoothingFactor);
    return voice.finished;
  }
  WavetableOscillator.getSample(voice, bufferOut, this.synthProps.masterParameters.interpolationType);
  LowpassFilter.apply(voice, bufferOut, lowpassExcursion, this.synthProps.filterSmoothingFactor);
  VolumeEnvelope.apply(voice, bufferOut, volumeExcursionCentibels, this.synthProps.volumeEnvelopeSmoothingFactor);
  this.panAndMixVoice(voice, bufferOut, outputLeft, outputRight, reverbOutputLeft, reverbOutputRight, chorusOutputLeft, chorusOutputRight, startIndex);
  return voice.finished;
}
var registeredParameterTypes = {
  pitchWheelRange: 0,
  fineTuning: 1,
  coarseTuning: 2,
  modulationDepth: 5,
  resetParameters: 16383
};
var nonRegisteredMSB = {
  partParameter: 1,
  awe32: 127,
  SF2: 120
};
var nonRegisteredLSB = {
  vibratoRate: 8,
  vibratoDepth: 9,
  vibratoDelay: 10,
  TVFFilterCutoff: 32,
  TVFFilterResonance: 33,
  EGAttackTime: 99,
  EGDecayTime: 100,
  EGReleaseTime: 102
};
function dataEntryCoarse(dataValue) {
  this.midiControllers[midiControllers.dataEntryMSB] = dataValue << 7;
  const addDefaultVibrato = () => {
    if (this.channelVibrato.delay === 0 && this.channelVibrato.rate === 0 && this.channelVibrato.depth === 0) {
      this.channelVibrato.depth = 50;
      this.channelVibrato.rate = 8;
      this.channelVibrato.delay = 0.6;
    }
  };
  const coolInfo = (what, value, type) => {
    if (type.length > 0) {
      type = " " + type;
    }
    SpessaSynthInfo(`%c${what} for %c${this.channelNumber}%c is now set to %c${value}%c${type}.`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.value, consoleColors.info);
  };
  switch (this.dataEntryState) {
    default:
    case dataEntryStates.Idle:
      break;
    case dataEntryStates.NRPFine: {
      if (this.lockGSNRPNParams) {
        return;
      }
      const NRPNCoarse = this.midiControllers[midiControllers.nonRegisteredParameterMSB] >> 7;
      const NRPNFine = this.midiControllers[midiControllers.nonRegisteredParameterLSB] >> 7;
      const dataEntryFine2 = this.midiControllers[midiControllers.dataEntryLSB] >> 7;
      switch (NRPNCoarse) {
        default:
          if (dataValue === 64) {
            return;
          }
          SpessaSynthInfo(`%cUnrecognized NRPN for %c${this.channelNumber}%c: %c(0x${NRPNFine.toString(16).toUpperCase()} 0x${NRPNFine.toString(16).toUpperCase()})%c data value: %c${dataValue}`, consoleColors.warn, consoleColors.recognized, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn, consoleColors.value);
          break;
        case nonRegisteredMSB.partParameter:
          switch (NRPNFine) {
            default:
              if (dataValue === 64) {
                return;
              }
              SpessaSynthInfo(`%cUnrecognized NRPN for %c${this.channelNumber}%c: %c(0x${NRPNCoarse.toString(16)} 0x${NRPNFine.toString(16)})%c data value: %c${dataValue}`, consoleColors.warn, consoleColors.recognized, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn, consoleColors.value);
              break;
            case nonRegisteredLSB.vibratoRate:
              if (dataValue === 64) {
                return;
              }
              addDefaultVibrato();
              this.channelVibrato.rate = dataValue / 64 * 8;
              coolInfo("Vibrato rate", `${dataValue} = ${this.channelVibrato.rate}`, "Hz");
              break;
            case nonRegisteredLSB.vibratoDepth:
              if (dataValue === 64) {
                return;
              }
              addDefaultVibrato();
              this.channelVibrato.depth = dataValue / 2;
              coolInfo("Vibrato depth", `${dataValue} = ${this.channelVibrato.depth}`, "cents of detune");
              break;
            case nonRegisteredLSB.vibratoDelay:
              if (dataValue === 64) {
                return;
              }
              addDefaultVibrato();
              this.channelVibrato.delay = dataValue / 64 / 3;
              coolInfo("Vibrato delay", `${dataValue} = ${this.channelVibrato.delay}`, "seconds");
              break;
            case nonRegisteredLSB.TVFFilterCutoff:
              this.controllerChange(midiControllers.brightness, dataValue);
              coolInfo("Filter cutoff", dataValue.toString(), "");
              break;
            case nonRegisteredLSB.TVFFilterResonance:
              this.controllerChange(midiControllers.filterResonance, dataValue);
              coolInfo("Filter resonance", dataValue.toString(), "");
              break;
            case nonRegisteredLSB.EGAttackTime:
              this.controllerChange(midiControllers.attackTime, dataValue);
              coolInfo("EG attack time", dataValue.toString(), "");
              break;
            case nonRegisteredLSB.EGDecayTime:
              this.controllerChange(midiControllers.decayTime, dataValue);
              coolInfo("EG decay time", dataValue.toString(), "");
              break;
            case nonRegisteredLSB.EGReleaseTime:
              this.controllerChange(midiControllers.releaseTime, dataValue);
              coolInfo("EG release time", dataValue.toString(), "");
              break;
          }
          break;
        case nonRegisteredMSB.awe32:
          break;
        case nonRegisteredMSB.SF2: {
          if (NRPNFine > 100) {
            break;
          }
          const gen = this.customControllers[customControllers.sf2NPRNGeneratorLSB];
          const offset = (dataValue << 7 | dataEntryFine2) - 8192;
          this.setGeneratorOffset(gen, offset);
          break;
        }
      }
      break;
    }
    case dataEntryStates.RPCoarse:
    case dataEntryStates.RPFine: {
      const rpnValue = this.midiControllers[midiControllers.registeredParameterMSB] | this.midiControllers[midiControllers.registeredParameterLSB] >> 7;
      switch (rpnValue) {
        default:
          SpessaSynthInfo(`%cUnrecognized RPN for %c${this.channelNumber}%c: %c(0x${rpnValue.toString(16)})%c data value: %c${dataValue}`, consoleColors.warn, consoleColors.recognized, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn, consoleColors.value);
          break;
        case registeredParameterTypes.pitchWheelRange:
          this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheelRange] = dataValue << 7;
          coolInfo("Pitch wheel range", dataValue.toString(), "semitones");
          break;
        case registeredParameterTypes.coarseTuning: {
          const semitones = dataValue - 64;
          this.setCustomController(customControllers.channelTuningSemitones, semitones);
          coolInfo("Coarse tuning", semitones.toString(), "semitones");
          break;
        }
        case registeredParameterTypes.fineTuning:
          this.setTuning(dataValue - 64, false);
          break;
        case registeredParameterTypes.modulationDepth:
          this.setModulationDepth(dataValue * 100);
          break;
        case registeredParameterTypes.resetParameters:
          this.resetParameters();
          break;
      }
    }
  }
}
var AWE_NRPN_GENERATOR_MAPPINGS = [
  generatorTypes.delayModLFO,
  generatorTypes.freqModLFO,
  generatorTypes.delayVibLFO,
  generatorTypes.freqVibLFO,
  generatorTypes.delayModEnv,
  generatorTypes.attackModEnv,
  generatorTypes.holdModEnv,
  generatorTypes.decayModEnv,
  generatorTypes.sustainModEnv,
  generatorTypes.releaseModEnv,
  generatorTypes.delayVolEnv,
  generatorTypes.attackVolEnv,
  generatorTypes.holdVolEnv,
  generatorTypes.decayVolEnv,
  generatorTypes.sustainVolEnv,
  generatorTypes.releaseVolEnv,
  generatorTypes.fineTune,
  generatorTypes.modLfoToPitch,
  generatorTypes.vibLfoToPitch,
  generatorTypes.modEnvToPitch,
  generatorTypes.modLfoToVolume,
  generatorTypes.initialFilterFc,
  generatorTypes.initialFilterQ,
  generatorTypes.modLfoToFilterFc,
  generatorTypes.modEnvToFilterFc,
  generatorTypes.chorusEffectsSend,
  generatorTypes.reverbEffectsSend
];
function handleAWE32NRPN(aweGen, dataLSB, dataMSB) {
  const clip = (v, min, max) => Math.max(min, Math.min(max, v));
  const msecToTimecents = (ms) => Math.max(-32768, 1200 * Math.log2(ms / 1000));
  const hzToCents = (hz) => 6900 + 1200 * Math.log2(hz / 440);
  let dataValue = dataMSB << 7 | dataLSB;
  dataValue -= 8192;
  const generator = AWE_NRPN_GENERATOR_MAPPINGS[aweGen];
  if (!generator) {
    SpessaSynthWarn(`Invalid AWE32 LSB: %c${aweGen}`, consoleColors.unrecognized);
  }
  let milliseconds, hertz, centibels, cents;
  switch (generator) {
    default:
      break;
    case generatorTypes.delayModLFO:
    case generatorTypes.delayVibLFO:
    case generatorTypes.delayVolEnv:
    case generatorTypes.delayModEnv:
      milliseconds = 4 * clip(dataValue, 0, 5900);
      this.setGeneratorOverride(generator, msecToTimecents(milliseconds));
      break;
    case generatorTypes.attackVolEnv:
    case generatorTypes.attackModEnv:
      milliseconds = clip(dataValue, 0, 5940);
      this.setGeneratorOverride(generator, msecToTimecents(milliseconds));
      break;
    case generatorTypes.holdVolEnv:
    case generatorTypes.holdModEnv:
      milliseconds = clip(dataValue, 0, 8191);
      this.setGeneratorOverride(generator, msecToTimecents(milliseconds));
      break;
    case generatorTypes.decayModEnv:
    case generatorTypes.decayVolEnv:
    case generatorTypes.releaseVolEnv:
    case generatorTypes.releaseModEnv:
      milliseconds = 4 * clip(dataValue, 0, 5940);
      this.setGeneratorOverride(generator, msecToTimecents(milliseconds));
      break;
    case generatorTypes.freqVibLFO:
    case generatorTypes.freqModLFO:
      hertz = 0.084 * dataLSB;
      this.setGeneratorOverride(generator, hzToCents(hertz), true);
      break;
    case generatorTypes.sustainVolEnv:
    case generatorTypes.sustainModEnv:
      centibels = dataLSB * 7.5;
      this.setGeneratorOverride(generator, centibels);
      break;
    case generatorTypes.fineTune:
      this.setGeneratorOverride(generator, dataValue, true);
      break;
    case generatorTypes.modLfoToPitch:
    case generatorTypes.vibLfoToPitch:
      cents = clip(dataValue, -127, 127) * 9.375;
      this.setGeneratorOverride(generator, cents, true);
      break;
    case generatorTypes.modEnvToPitch:
      cents = clip(dataValue, -127, 127) * 9.375;
      this.setGeneratorOverride(generator, cents);
      break;
    case generatorTypes.modLfoToVolume:
      centibels = 1.875 * dataLSB;
      this.setGeneratorOverride(generator, centibels, true);
      break;
    case generatorTypes.initialFilterFc: {
      const fcCents = 4335 + 59 * dataLSB;
      this.setGeneratorOverride(generator, fcCents, true);
      break;
    }
    case generatorTypes.initialFilterQ:
      centibels = 215 * (dataLSB / 127);
      this.setGeneratorOverride(generator, centibels, true);
      break;
    case generatorTypes.modLfoToFilterFc:
      cents = clip(dataValue, -64, 63) * 56.25;
      this.setGeneratorOverride(generator, cents, true);
      break;
    case generatorTypes.modEnvToFilterFc:
      cents = clip(dataValue, -64, 63) * 56.25;
      this.setGeneratorOverride(generator, cents);
      break;
    case generatorTypes.chorusEffectsSend:
    case generatorTypes.reverbEffectsSend:
      this.setGeneratorOverride(generator, clip(dataValue, 0, 255) * (1000 / 255));
      break;
  }
}
function dataEntryFine(dataValue) {
  this.midiControllers[midiControllers.dataEntryLSB] = dataValue << 7;
  switch (this.dataEntryState) {
    default:
      break;
    case dataEntryStates.RPCoarse:
    case dataEntryStates.RPFine: {
      const rpnValue = this.midiControllers[midiControllers.registeredParameterMSB] | this.midiControllers[midiControllers.registeredParameterLSB] >> 7;
      switch (rpnValue) {
        default:
          break;
        case registeredParameterTypes.pitchWheelRange: {
          if (dataValue === 0) {
            break;
          }
          this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheelRange] |= dataValue;
          const actualTune = (this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheelRange] >> 7) + dataValue / 128;
          SpessaSynthInfo(`%cChannel ${this.channelNumber} pitch wheel range. Semitones: %c${actualTune}`, consoleColors.info, consoleColors.value);
          break;
        }
        case registeredParameterTypes.fineTuning: {
          const coarse = this.customControllers[customControllers.channelTuning];
          const finalTuning = coarse << 7 | dataValue;
          this.setTuning(finalTuning * 0.01220703125);
          break;
        }
        case registeredParameterTypes.modulationDepth: {
          const currentModulationDepthCents = this.customControllers[customControllers.modulationMultiplier] * 50;
          const cents = currentModulationDepthCents + dataValue / 128 * 100;
          this.setModulationDepth(cents);
          break;
        }
        case 16383:
          this.resetParameters();
          break;
      }
      break;
    }
    case dataEntryStates.NRPFine: {
      const NRPNCoarse = this.midiControllers[midiControllers.nonRegisteredParameterMSB] >> 7;
      const NRPNFine = this.midiControllers[midiControllers.nonRegisteredParameterLSB] >> 7;
      if (NRPNCoarse === nonRegisteredMSB.SF2) {
        return;
      }
      switch (NRPNCoarse) {
        default:
          SpessaSynthInfo(`%cUnrecognized NRPN LSB for %c${this.channelNumber}%c: %c(0x${NRPNFine.toString(16).toUpperCase()} 0x${NRPNFine.toString(16).toUpperCase()})%c data value: %c${dataValue}`, consoleColors.warn, consoleColors.recognized, consoleColors.warn, consoleColors.unrecognized, consoleColors.warn, consoleColors.value);
          break;
        case nonRegisteredMSB.awe32:
          handleAWE32NRPN.call(this, NRPNFine, dataValue, this.midiControllers[midiControllers.dataEntryMSB] >> 7);
          break;
      }
    }
  }
}
function controllerChange(controllerNumber, controllerValue, sendEvent = true) {
  if (controllerNumber > 127) {
    throw new Error("Invalid MIDI Controller.");
  }
  if (controllerNumber >= midiControllers.modulationWheelLSB && controllerNumber <= midiControllers.effectControl2LSB && controllerNumber !== midiControllers.dataEntryLSB) {
    const actualCCNum = controllerNumber - 32;
    if (this.lockedControllers[actualCCNum]) {
      return;
    }
    this.midiControllers[actualCCNum] = this.midiControllers[actualCCNum] & 16256 | controllerValue & 127;
    this.voices.forEach((v) => this.computeModulators(v, 1, actualCCNum));
  }
  if (this.lockedControllers[controllerNumber]) {
    return;
  }
  this.midiControllers[controllerNumber] = controllerValue << 7;
  {
    switch (controllerNumber) {
      case midiControllers.allNotesOff:
        this.stopAllNotes();
        break;
      case midiControllers.allSoundOff:
        this.stopAllNotes(true);
        break;
      case midiControllers.bankSelect:
        this.setBankMSB(controllerValue);
        if (this.channelNumber % 16 === DEFAULT_PERCUSSION && BankSelectHacks.isSystemXG(this.channelSystem)) {
          this.setBankMSB(127);
        }
        break;
      case midiControllers.bankSelectLSB:
        this.setBankLSB(controllerValue);
        break;
      case midiControllers.registeredParameterLSB:
        this.dataEntryState = dataEntryStates.RPFine;
        break;
      case midiControllers.registeredParameterMSB:
        this.dataEntryState = dataEntryStates.RPCoarse;
        break;
      case midiControllers.nonRegisteredParameterMSB:
        this.customControllers[customControllers.sf2NPRNGeneratorLSB] = 0;
        this.dataEntryState = dataEntryStates.NRPCoarse;
        break;
      case midiControllers.nonRegisteredParameterLSB:
        if (this.midiControllers[midiControllers.nonRegisteredParameterMSB] >> 7 === nonRegisteredMSB.SF2) {
          if (this.customControllers[customControllers.sf2NPRNGeneratorLSB] % 100 !== 0) {
            this.customControllers[customControllers.sf2NPRNGeneratorLSB] = 0;
          }
          if (controllerValue === 100) {
            this.customControllers[customControllers.sf2NPRNGeneratorLSB] += 100;
          } else if (controllerValue === 101) {
            this.customControllers[customControllers.sf2NPRNGeneratorLSB] += 1000;
          } else if (controllerValue === 102) {
            this.customControllers[customControllers.sf2NPRNGeneratorLSB] += 1e4;
          } else if (controllerValue < 100) {
            this.customControllers[customControllers.sf2NPRNGeneratorLSB] += controllerValue;
          }
        }
        this.dataEntryState = dataEntryStates.NRPFine;
        break;
      case midiControllers.dataEntryMSB:
        this.dataEntryCoarse(controllerValue);
        break;
      case midiControllers.dataEntryLSB:
        this.dataEntryFine(controllerValue);
        break;
      case midiControllers.resetAllControllers:
        this.resetControllersRP15Compliant();
        break;
      case midiControllers.sustainPedal:
        if (controllerValue < 64) {
          this.sustainedVoices.forEach((v) => {
            v.release(this.synth.currentSynthTime);
          });
          this.sustainedVoices = [];
        }
        break;
      default:
        this.voices.forEach((v) => this.computeModulators(v, 1, controllerNumber));
        break;
    }
  }
  if (!sendEvent) {
    return;
  }
  this.synthProps.callEvent("controllerChange", {
    channel: this.channelNumber,
    controllerNumber,
    controllerValue
  });
}
var portamentoLookup = {
  0: 0,
  1: 0.006,
  2: 0.023,
  4: 0.05,
  8: 0.11,
  16: 0.25,
  32: 0.5,
  64: 2.06,
  80: 4.2,
  96: 8.4,
  112: 19.5,
  116: 26.7,
  120: 40,
  124: 80,
  127: 480
};
function portaTimeToRate(value) {
  let portaTime = 0;
  if (portamentoLookup[value] !== undefined) {
    portaTime = portamentoLookup[value];
  }
  let lower = null;
  let upper = null;
  for (const k of Object.keys(portamentoLookup)) {
    const key = parseInt(k);
    if (key < value && (lower === null || key > lower)) {
      lower = key;
    }
    if (key > value && (upper === null || key < upper)) {
      upper = key;
    }
  }
  if (lower !== null && upper !== null) {
    const lowerTime = portamentoLookup[lower];
    const upperTime = portamentoLookup[upper];
    portaTime = lowerTime + (value - lower) * (upperTime - lowerTime) / (upper - lower);
  }
  return portaTime / 40;
}
function portamentoTimeToSeconds(time, distance) {
  return portaTimeToRate(time) * distance;
}
function noteOn(midiNote, velocity) {
  if (velocity < 1) {
    this.noteOff(midiNote);
    return;
  }
  velocity = Math.min(127, velocity);
  if (this.synthProps.masterParameters.blackMIDIMode && this.synth.totalVoicesAmount > 200 && velocity < 40 || this.synthProps.masterParameters.blackMIDIMode && velocity < 10 || this._isMuted) {
    return;
  }
  if (!this.preset) {
    SpessaSynthWarn(`No preset for channel ${this.channelNumber}!`);
    return;
  }
  const realKey = midiNote + this.channelTransposeKeyShift + this.customControllers[customControllers.channelKeyShift];
  let internalMidiNote = realKey;
  if (realKey > 127 || realKey < 0) {
    return;
  }
  const program = this.preset?.program;
  const tune = this.synthProps.tunings[program]?.[realKey]?.midiNote;
  if (tune >= 0) {
    internalMidiNote = tune;
  }
  if (this.synthProps.masterParameters.monophonicRetriggerMode) {
    this.killNote(midiNote, -7200);
  }
  const keyVel = this.synth.keyModifierManager.getVelocity(this.channelNumber, realKey);
  if (keyVel > -1) {
    velocity = keyVel;
  }
  const voiceGain = this.synth.keyModifierManager.getGain(this.channelNumber, realKey);
  let portamentoFromKey = -1;
  let portamentoDuration = 0;
  const portamentoTime = this.midiControllers[midiControllers.portamentoTime] >> 7;
  const portaControl = this.midiControllers[midiControllers.portamentoControl] >> 7;
  if (!this.drumChannel && portaControl !== internalMidiNote && this.midiControllers[midiControllers.portamentoOnOff] >= 8192 && portamentoTime > 0) {
    if (portaControl > 0) {
      const diff = Math.abs(internalMidiNote - portaControl);
      portamentoDuration = portamentoTimeToSeconds(portamentoTime, diff);
      portamentoFromKey = portaControl;
    }
    this.controllerChange(midiControllers.portamentoControl, internalMidiNote);
  }
  const voices = this.synthProps.getVoices(this.channelNumber, internalMidiNote, velocity, realKey);
  let panOverride = 0;
  if (this.randomPan) {
    panOverride = Math.round(Math.random() * 1000 - 500);
  }
  const channelVoices = this.voices;
  voices.forEach((voice) => {
    voice.portamentoFromKey = portamentoFromKey;
    voice.portamentoDuration = portamentoDuration;
    voice.overridePan = panOverride;
    voice.gain = voiceGain;
    this.sysExModulators.modulatorList.forEach((m) => {
      const mod = m.mod;
      const existingModIndex = voice.modulators.findIndex((voiceMod) => Modulator.isIdentical(voiceMod, mod));
      if (existingModIndex !== -1) {
        voice.modulators[existingModIndex] = Modulator.copyFrom(mod);
      } else {
        voice.modulators.push(Modulator.copyFrom(mod));
      }
    });
    if (this.generatorOverridesEnabled) {
      this.generatorOverrides.forEach((overrideValue, generatorType) => {
        if (overrideValue === GENERATOR_OVERRIDE_NO_CHANGE_VALUE) {
          return;
        }
        voice.generators[generatorType] = overrideValue;
      });
    }
    const exclusive = voice.exclusiveClass;
    if (exclusive !== 0) {
      channelVoices.forEach((v) => {
        if (v.exclusiveClass === exclusive) {
          v.exclusiveRelease(this.synth.currentSynthTime);
        }
      });
    }
    this.computeModulators(voice);
    const cursorStartOffset = voice.modulatedGenerators[generatorTypes.startAddrsOffset] + voice.modulatedGenerators[generatorTypes.startAddrsCoarseOffset] * 32768;
    const endOffset = voice.modulatedGenerators[generatorTypes.endAddrOffset] + voice.modulatedGenerators[generatorTypes.endAddrsCoarseOffset] * 32768;
    const loopStartOffset = voice.modulatedGenerators[generatorTypes.startloopAddrsOffset] + voice.modulatedGenerators[generatorTypes.startloopAddrsCoarseOffset] * 32768;
    const loopEndOffset = voice.modulatedGenerators[generatorTypes.endloopAddrsOffset] + voice.modulatedGenerators[generatorTypes.endloopAddrsCoarseOffset] * 32768;
    const sm = voice.sample;
    const clamp = (num) => Math.max(0, Math.min(sm.sampleData.length - 1, num));
    sm.cursor = clamp(sm.cursor + cursorStartOffset);
    sm.end = clamp(sm.end + endOffset);
    sm.loopStart = clamp(sm.loopStart + loopStartOffset);
    sm.loopEnd = clamp(sm.loopEnd + loopEndOffset);
    if (sm.loopEnd < sm.loopStart) {
      const temp = sm.loopStart;
      sm.loopStart = sm.loopEnd;
      sm.loopEnd = temp;
    }
    if (sm.loopEnd - sm.loopStart < 1) {
      if (sm.loopingMode === 1 || sm.loopingMode === 3) {
        sm.loopingMode = 0;
        sm.isLooping = false;
      }
    }
    voice.volumeEnvelope.attenuation = voice.volumeEnvelope.attenuationTargetGain;
    voice.currentPan = Math.max(-500, Math.min(500, voice.modulatedGenerators[generatorTypes.pan]));
  });
  this.synth.totalVoicesAmount += voices.length;
  if (this.synth.totalVoicesAmount > this.synthProps.masterParameters.voiceCap) {
    this.synthProps.voiceKilling(voices.length);
  }
  channelVoices.push(...voices);
  this.sendChannelProperty();
  this.synthProps.callEvent("noteOn", {
    midiNote,
    channel: this.channelNumber,
    velocity
  });
}
function noteOff(midiNote) {
  if (midiNote > 127 || midiNote < 0) {
    SpessaSynthWarn(`Received a noteOn for note`, midiNote, "Ignoring.");
    return;
  }
  const realKey = midiNote + this.channelTransposeKeyShift + this.customControllers[customControllers.channelKeyShift];
  if (this.synthProps.masterParameters.blackMIDIMode) {
    if (!this.drumChannel) {
      this.killNote(realKey, -6950);
      this.synthProps.callEvent("noteOff", {
        midiNote,
        channel: this.channelNumber
      });
      return;
    }
  }
  const channelVoices = this.voices;
  channelVoices.forEach((v) => {
    if (v.realKey !== realKey || v.isInRelease) {
      return;
    }
    if (this.holdPedal) {
      this.sustainedVoices.push(v);
    } else {
      v.release(this.synth.currentSynthTime);
    }
  });
  this.synthProps.callEvent("noteOff", {
    midiNote,
    channel: this.channelNumber
  });
}
function programChange(program) {
  if (this.lockPreset) {
    return;
  }
  this.patch.program = program;
  let preset = this.synth.soundBankManager.getPreset(this.patch, this.channelSystem);
  if (!preset) {
    SpessaSynthWarn("No presets! Using empty fallback.");
    preset = new BasicPreset(this.synth.soundBankManager.soundBankList[0].soundBank);
    preset.name = "SPESSA EMPTY FALLBACK PRESET";
  }
  this.preset = preset;
  if (preset.isAnyDrums !== this.drumChannel) {
    this.setDrumFlag(preset.isAnyDrums);
  }
  this.synthProps.callEvent("programChange", {
    channel: this.channelNumber,
    bankLSB: this.preset.bankLSB,
    bankMSB: this.preset.bankMSB,
    program: this.preset.program,
    isGMGSDrum: this.preset.isGMGSDrum
  });
  this.sendChannelProperty();
}
var DynamicModulatorSystem = class {
  modulatorList = [];
  resetModulators() {
    this.modulatorList = [];
  }
  setModulator(source, destination, amount, isBipolar = false, isNegative = false) {
    const id = this.getModulatorID(source, destination, isBipolar, isNegative);
    if (amount === 0) {
      this.deleteModulator(id);
    }
    const mod = this.modulatorList.find((m) => m.id === id);
    if (mod) {
      mod.mod.transformAmount = amount;
    } else {
      let srcNum, isCC;
      if (source >= NON_CC_INDEX_OFFSET) {
        srcNum = source - NON_CC_INDEX_OFFSET;
        isCC = false;
      } else {
        srcNum = source;
        isCC = true;
      }
      const modulator = new Modulator(new ModulatorSource(srcNum, modulatorCurveTypes.linear, isCC, isBipolar), new ModulatorSource, destination, amount, 0);
      this.modulatorList.push({
        mod: modulator,
        id
      });
    }
  }
  getModulatorID(source, destination, isBipolar, isNegative) {
    return `${source}-${destination}-${isBipolar}-${isNegative}`;
  }
  deleteModulator(id) {
    this.modulatorList = this.modulatorList.filter((m) => m.id !== id);
  }
};
var EFFECT_MODULATOR_TRANSFORM_MULTIPLIER = 1000 / 200;
function computeModulator(controllerTable, modulator, voice) {
  if (modulator.transformAmount === 0) {
    modulator.currentValue = 0;
    return 0;
  }
  const sourceValue = modulator.primarySource.getValue(controllerTable, voice);
  const secondSrcValue = modulator.secondarySource.getValue(controllerTable, voice);
  let transformAmount = modulator.transformAmount;
  if (modulator.isEffectModulator && transformAmount <= 1000) {
    transformAmount *= EFFECT_MODULATOR_TRANSFORM_MULTIPLIER;
    transformAmount = Math.min(transformAmount, 1000);
  }
  let computedValue = sourceValue * secondSrcValue * transformAmount;
  if (modulator.transformType === 2) {
    computedValue = Math.abs(computedValue);
  }
  if (modulator.isDefaultResonantModulator) {
    voice.resonanceOffset = Math.max(0, computedValue / 2);
  }
  modulator.currentValue = computedValue;
  return computedValue;
}
function computeModulators(voice, sourceUsesCC = -1, sourceIndex = 0) {
  const modulators = voice.modulators;
  let generators = voice.generators;
  if (this.generatorOffsetsEnabled) {
    generators = new Int16Array(generators);
    for (let i = 0;i < generators.length; i++) {
      generators[i] += this.generatorOffsets[i];
    }
  }
  const modulatedGenerators = voice.modulatedGenerators;
  if (sourceUsesCC === -1) {
    modulatedGenerators.set(generators);
    modulators.forEach((mod) => {
      modulatedGenerators[mod.destination] = Math.min(32767, Math.max(-32768, modulatedGenerators[mod.destination] + computeModulator(this.midiControllers, mod, voice)));
    });
    for (let gen = 0;gen < modulatedGenerators.length; gen++) {
      const limit = generatorLimits[gen];
      if (!limit) {
        continue;
      }
      modulatedGenerators[gen] = Math.min(limit.max, Math.max(limit.min, modulatedGenerators[gen]));
    }
    VolumeEnvelope.recalculate(voice);
    ModulationEnvelope.recalculate(voice);
    return;
  }
  const volumeEnvelopeNeedsRecalculation = /* @__PURE__ */ new Set([
    generatorTypes.initialAttenuation,
    generatorTypes.delayVolEnv,
    generatorTypes.attackVolEnv,
    generatorTypes.holdVolEnv,
    generatorTypes.decayVolEnv,
    generatorTypes.sustainVolEnv,
    generatorTypes.releaseVolEnv,
    generatorTypes.keyNumToVolEnvHold,
    generatorTypes.keyNumToVolEnvDecay
  ]);
  const computedDestinations = /* @__PURE__ */ new Set;
  const sourceCC = !!sourceUsesCC;
  modulators.forEach((mod) => {
    if (mod.primarySource.isCC === sourceCC && mod.primarySource.index === sourceIndex || mod.secondarySource.isCC === sourceCC && mod.secondarySource.index === sourceIndex) {
      const destination = mod.destination;
      if (!computedDestinations.has(destination)) {
        let outputValue = generators[destination];
        computeModulator(this.midiControllers, mod, voice);
        modulators.forEach((m) => {
          if (m.destination === destination) {
            outputValue += m.currentValue;
          }
        });
        const limits = generatorLimits[destination];
        modulatedGenerators[destination] = Math.max(limits.min, Math.min(outputValue, limits.max));
        computedDestinations.add(destination);
      }
    }
  });
  if ([...computedDestinations].some((dest) => volumeEnvelopeNeedsRecalculation.has(dest))) {
    VolumeEnvelope.recalculate(voice);
  }
  ModulationEnvelope.recalculate(voice);
}
var MIDIChannel = class {
  midiControllers = new Int16Array(CONTROLLER_TABLE_SIZE);
  lockedControllers = Array(CONTROLLER_TABLE_SIZE).fill(false);
  customControllers = new Float32Array(CUSTOM_CONTROLLER_TABLE_SIZE);
  channelTransposeKeyShift = 0;
  channelOctaveTuning = new Int8Array(128);
  sysExModulators = new DynamicModulatorSystem;
  drumChannel = false;
  randomPan = false;
  dataEntryState = dataEntryStates.Idle;
  patch = {
    bankMSB: 0,
    bankLSB: 0,
    program: 0,
    isGMGSDrum: false
  };
  preset;
  lockPreset = false;
  lockedSystem = "gs";
  lockGSNRPNParams = false;
  channelVibrato = {
    delay: 0,
    depth: 0,
    rate: 0
  };
  voices = [];
  sustainedVoices = [];
  channelNumber;
  synth;
  synthProps;
  noteOn = noteOn.bind(this);
  noteOff = noteOff.bind(this);
  programChange = programChange.bind(this);
  controllerChange = controllerChange.bind(this);
  resetControllers = resetControllers.bind(this);
  resetPreset = resetPreset.bind(this);
  resetControllersRP15Compliant = resetControllersRP15Compliant.bind(this);
  resetParameters = resetParameters.bind(this);
  dataEntryFine = dataEntryFine.bind(this);
  dataEntryCoarse = dataEntryCoarse.bind(this);
  channelTuningCents = 0;
  generatorOffsets = new Int16Array(GENERATORS_AMOUNT);
  generatorOffsetsEnabled = false;
  generatorOverrides = new Int16Array(GENERATORS_AMOUNT);
  generatorOverridesEnabled = false;
  renderVoice = renderVoice.bind(this);
  panAndMixVoice = panAndMixVoice.bind(this);
  computeModulators = computeModulators.bind(this);
  constructor(synth, synthProps, preset, channelNumber) {
    this.synth = synth;
    this.synthProps = synthProps;
    this.preset = preset;
    this.channelNumber = channelNumber;
    this.resetGeneratorOverrides();
    this.resetGeneratorOffsets();
  }
  _isMuted = false;
  get isMuted() {
    return this._isMuted;
  }
  get holdPedal() {
    return this.midiControllers[midiControllers.sustainPedal] >= 8192;
  }
  get channelSystem() {
    return this.lockPreset ? this.lockedSystem : this.synthProps.masterParameters.midiSystem;
  }
  transposeChannel(semitones, force = false) {
    if (!this.drumChannel) {
      semitones += this.synthProps.masterParameters.transposition;
    }
    const keyShift = Math.trunc(semitones);
    const currentTranspose = this.channelTransposeKeyShift + this.customControllers[customControllers.channelTransposeFine] / 100;
    if (this.drumChannel && !force || semitones === currentTranspose) {
      return;
    }
    if (keyShift !== this.channelTransposeKeyShift) {
      this.stopAllNotes();
    }
    this.channelTransposeKeyShift = keyShift;
    this.setCustomController(customControllers.channelTransposeFine, (semitones - keyShift) * 100);
    this.sendChannelProperty();
  }
  setOctaveTuning(tuning) {
    if (tuning.length !== 12) {
      throw new Error("Tuning is not the length of 12.");
    }
    this.channelOctaveTuning = new Int8Array(128);
    for (let i = 0;i < 128; i++) {
      this.channelOctaveTuning[i] = tuning[i % 12];
    }
  }
  setModulationDepth(cents) {
    cents = Math.round(cents);
    SpessaSynthInfo(`%cChannel ${this.channelNumber} modulation depth. Cents: %c${cents}`, consoleColors.info, consoleColors.value);
    this.setCustomController(customControllers.modulationMultiplier, cents / 50);
  }
  setTuning(cents, log = true) {
    cents = Math.round(cents);
    this.setCustomController(customControllers.channelTuning, cents);
    if (!log) {
      return;
    }
    SpessaSynthInfo(`%cFine tuning for %c${this.channelNumber}%c is now set to %c${cents}%c cents.`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.value, consoleColors.info);
  }
  pitchWheel(pitch) {
    if (this.lockedControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel]) {
      return;
    }
    this.synthProps.callEvent("pitchWheel", {
      channel: this.channelNumber,
      pitch
    });
    this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel] = pitch;
    this.voices.forEach((v) => this.computeModulators(v, 0, modulatorSources.pitchWheel));
    this.sendChannelProperty();
  }
  channelPressure(pressure) {
    this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.channelPressure] = pressure << 7;
    this.updateChannelTuning();
    this.voices.forEach((v) => this.computeModulators(v, 0, modulatorSources.channelPressure));
    this.synthProps.callEvent("channelPressure", {
      channel: this.channelNumber,
      pressure
    });
  }
  polyPressure(midiNote, pressure) {
    this.voices.forEach((v) => {
      if (v.midiNote !== midiNote) {
        return;
      }
      v.pressure = pressure;
      this.computeModulators(v, 0, modulatorSources.polyPressure);
    });
    this.synthProps.callEvent("polyPressure", {
      channel: this.channelNumber,
      midiNote,
      pressure
    });
  }
  setCustomController(type, value) {
    this.customControllers[type] = value;
    this.updateChannelTuning();
  }
  updateChannelTuning() {
    this.channelTuningCents = this.customControllers[customControllers.channelTuning] + this.customControllers[customControllers.channelTransposeFine] + this.customControllers[customControllers.masterTuning] + this.customControllers[customControllers.channelTuningSemitones] * 100;
  }
  renderAudio(outputLeft, outputRight, reverbOutputLeft, reverbOutputRight, chorusOutputLeft, chorusOutputRight, startIndex, sampleCount) {
    this.voices = this.voices.filter((v) => !this.renderVoice(v, this.synth.currentSynthTime, outputLeft, outputRight, reverbOutputLeft, reverbOutputRight, chorusOutputLeft, chorusOutputRight, startIndex, sampleCount));
  }
  setPresetLock(locked) {
    if (this.lockPreset === locked) {
      return;
    }
    this.lockPreset = locked;
    if (locked) {
      this.lockedSystem = this.synthProps.masterParameters.midiSystem;
    }
  }
  setDrums(isDrum) {
    if (BankSelectHacks.isSystemXG(this.channelSystem)) {
      if (isDrum) {
        this.setBankMSB(BankSelectHacks.getDrumBank(this.channelSystem));
        this.setBankLSB(0);
      } else {
        if (this.channelNumber % 16 === DEFAULT_PERCUSSION) {
          throw new Error(`Cannot disable drums on channel ${this.channelNumber} for XG.`);
        }
        this.setBankMSB(0);
        this.setBankLSB(0);
      }
    } else {
      this.setGSDrums(isDrum);
    }
    this.setDrumFlag(isDrum);
    this.programChange(this.patch.program);
  }
  setPatch(patch) {
    this.setBankMSB(patch.bankMSB);
    this.setBankLSB(patch.bankLSB);
    this.setGSDrums(patch.isGMGSDrum);
    this.programChange(patch.program);
  }
  setGSDrums(drums) {
    if (drums === this.patch.isGMGSDrum) {
      return;
    }
    this.setBankLSB(0);
    this.setBankMSB(0);
    this.patch.isGMGSDrum = drums;
  }
  setVibrato(depth, rate, delay) {
    if (this.lockGSNRPNParams) {
      return;
    }
    this.channelVibrato.rate = rate;
    this.channelVibrato.delay = delay;
    this.channelVibrato.depth = depth;
  }
  disableAndLockGSNRPN() {
    this.lockGSNRPNParams = true;
    this.channelVibrato.rate = 0;
    this.channelVibrato.delay = 0;
    this.channelVibrato.depth = 0;
  }
  resetGeneratorOverrides() {
    this.generatorOverrides.fill(GENERATOR_OVERRIDE_NO_CHANGE_VALUE);
    this.generatorOverridesEnabled = false;
  }
  setGeneratorOverride(gen, value, realtime = false) {
    this.generatorOverrides[gen] = value;
    this.generatorOverridesEnabled = true;
    if (realtime) {
      this.voices.forEach((v) => {
        v.generators[gen] = value;
        this.computeModulators(v);
      });
    }
  }
  resetGeneratorOffsets() {
    this.generatorOffsets.fill(0);
    this.generatorOffsetsEnabled = false;
  }
  setGeneratorOffset(gen, value) {
    this.generatorOffsets[gen] = value * generatorLimits[gen].nrpn;
    this.generatorOffsetsEnabled = true;
    this.voices.forEach((v) => {
      this.computeModulators(v);
    });
  }
  killNote(midiNote, releaseTime = -12000) {
    midiNote += this.customControllers[customControllers.channelKeyShift];
    this.voices.forEach((v) => {
      if (v.realKey !== midiNote) {
        return;
      }
      v.modulatedGenerators[generatorTypes.releaseVolEnv] = releaseTime;
      v.release(this.synth.currentSynthTime);
    });
  }
  stopAllNotes(force = false) {
    if (force) {
      this.voices.length = 0;
      this.sustainedVoices.length = 0;
      this.sendChannelProperty();
    } else {
      this.voices.forEach((v) => {
        if (v.isInRelease) {
          return;
        }
        v.release(this.synth.currentSynthTime);
      });
      this.sustainedVoices.forEach((v) => {
        v.release(this.synth.currentSynthTime);
      });
    }
    this.synthProps.callEvent("stopAll", {
      channel: this.channelNumber,
      force
    });
  }
  muteChannel(isMuted) {
    if (isMuted) {
      this.stopAllNotes(true);
    }
    this._isMuted = isMuted;
    this.sendChannelProperty();
    this.synthProps.callEvent("muteChannel", {
      channel: this.channelNumber,
      isMuted
    });
  }
  sendChannelProperty() {
    if (!this.synth.enableEventSystem) {
      return;
    }
    const data = {
      voicesAmount: this.voices.length,
      pitchWheel: this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheel],
      pitchWheelRange: this.midiControllers[NON_CC_INDEX_OFFSET + modulatorSources.pitchWheelRange] / 128,
      isMuted: this.isMuted,
      transposition: this.channelTransposeKeyShift + this.customControllers[customControllers.channelTransposeFine] / 100,
      isDrum: this.drumChannel
    };
    this.synthProps.callEvent("channelPropertyChange", {
      channel: this.channelNumber,
      property: data
    });
  }
  setBankMSB(bankMSB) {
    if (this.lockPreset) {
      return;
    }
    this.patch.bankMSB = bankMSB;
  }
  setBankLSB(bankLSB) {
    if (this.lockPreset) {
      return;
    }
    this.patch.bankLSB = bankLSB;
  }
  setDrumFlag(isDrum) {
    if (this.lockPreset || !this.preset) {
      return;
    }
    if (this.drumChannel === isDrum) {
      return;
    }
    if (isDrum) {
      this.channelTransposeKeyShift = 0;
      this.drumChannel = true;
    } else {
      this.drumChannel = false;
    }
    this.synthProps.callEvent("drumChange", {
      channel: this.channelNumber,
      isDrumChannel: this.drumChannel
    });
  }
};
var SDTA_TO_DATA_OFFSET = 4 + 4 + 4 + 4 + 4;
async function getSDTA(bank, smplStartOffsets, smplEndOffsets, compress, decompress, vorbisFunc, progressFunc) {
  let writtenCount = 0;
  let smplChunkSize = 0;
  const sampleDatas = [];
  for (const s of bank.samples) {
    if (compress && vorbisFunc) {
      await s.compressSample(vorbisFunc);
    }
    if (decompress) {
      s.setAudioData(s.getAudioData(), s.sampleRate);
    }
    const r = s.getRawData(true);
    writtenCount++;
    await progressFunc?.(s.name, writtenCount, bank.samples.length);
    SpessaSynthInfo(`%cEncoded sample %c${writtenCount}. ${s.name}%c of %c${bank.samples.length}%c. Compressed: %c${s.isCompressed}%c.`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info, s.isCompressed ? consoleColors.recognized : consoleColors.unrecognized, consoleColors.info);
    smplChunkSize += r.length + (s.isCompressed ? 0 : 92);
    sampleDatas.push(r);
  }
  if (smplChunkSize % 2 !== 0) {
    smplChunkSize++;
  }
  const sdta = new IndexedByteArray(smplChunkSize + SDTA_TO_DATA_OFFSET);
  writeBinaryStringIndexed(sdta, "LIST");
  writeLittleEndianIndexed(sdta, smplChunkSize + SDTA_TO_DATA_OFFSET - 8, 4);
  writeBinaryStringIndexed(sdta, "sdta");
  writeBinaryStringIndexed(sdta, "smpl");
  writeLittleEndianIndexed(sdta, smplChunkSize, 4);
  let offset = 0;
  bank.samples.forEach((sample, i) => {
    const data = sampleDatas[i];
    sdta.set(data, offset + SDTA_TO_DATA_OFFSET);
    let startOffset;
    let endOffset;
    if (sample.isCompressed) {
      startOffset = offset;
      endOffset = startOffset + data.length;
    } else {
      startOffset = offset / 2;
      endOffset = startOffset + data.length / 2;
      offset += 92;
    }
    offset += data.length;
    smplStartOffsets.push(startOffset);
    smplEndOffsets.push(endOffset);
  });
  return sdta;
}
var RESAMPLE_RATE = 48000;
var BasicSample = class {
  name;
  sampleRate;
  originalKey;
  pitchCorrection;
  linkedSample;
  sampleType;
  loopStart;
  loopEnd;
  linkedTo = [];
  dataOverridden = true;
  compressedData;
  audioData;
  constructor(sampleName, sampleRate, originalKey, pitchCorrection, sampleType, loopStart, loopEnd) {
    this.name = sampleName;
    this.sampleRate = sampleRate;
    this.originalKey = originalKey;
    this.pitchCorrection = pitchCorrection;
    this.loopStart = loopStart;
    this.loopEnd = loopEnd;
    this.sampleType = sampleType;
  }
  get isCompressed() {
    return this.compressedData !== undefined;
  }
  get isLinked() {
    return this.sampleType === sampleTypes.rightSample || this.sampleType === sampleTypes.leftSample || this.sampleType === sampleTypes.linkedSample;
  }
  get useCount() {
    return this.linkedTo.length;
  }
  getRawData(allowVorbis) {
    if (this.compressedData && allowVorbis && !this.dataOverridden) {
      return this.compressedData;
    }
    return this.encodeS16LE();
  }
  resampleData(newSampleRate) {
    let audioData = this.getAudioData();
    const ratio = newSampleRate / this.sampleRate;
    const resampled = new Float32Array(Math.floor(audioData.length * ratio));
    for (let i = 0;i < resampled.length; i++) {
      resampled[i] = audioData[Math.floor(i * (1 / ratio))];
    }
    audioData = resampled;
    this.sampleRate = newSampleRate;
    this.loopStart = Math.floor(this.loopStart * ratio);
    this.loopEnd = Math.floor(this.loopEnd * ratio);
    this.audioData = audioData;
  }
  async compressSample(encodeVorbis) {
    if (this.isCompressed) {
      return;
    }
    try {
      let audioData = this.getAudioData();
      if (this.sampleRate < 8000 || this.sampleRate > 96000) {
        this.resampleData(RESAMPLE_RATE);
        audioData = this.getAudioData();
      }
      const compressed = await encodeVorbis(audioData, this.sampleRate);
      this.setCompressedData(compressed);
    } catch (e) {
      SpessaSynthWarn(`Failed to compress ${this.name}. Leaving as uncompressed!`, e);
      this.compressedData = undefined;
    }
  }
  setSampleType(type) {
    this.sampleType = type;
    if (!this.isLinked) {
      if (this.linkedSample) {
        this.linkedSample.linkedSample = undefined;
        this.linkedSample.sampleType = type;
      }
      this.linkedSample = undefined;
    }
    if ((type & 32768) > 0) {
      throw new Error("ROM samples are not supported.");
    }
  }
  unlinkSample() {
    this.setSampleType(sampleTypes.monoSample);
  }
  setLinkedSample(sample, type) {
    if (sample.linkedSample) {
      throw new Error(`${sample.name} is linked tp ${sample.linkedSample.name}. Unlink it first.`);
    }
    this.linkedSample = sample;
    sample.linkedSample = this;
    if (type === sampleTypes.leftSample) {
      this.setSampleType(sampleTypes.leftSample);
      sample.setSampleType(sampleTypes.rightSample);
    } else if (type === sampleTypes.rightSample) {
      this.setSampleType(sampleTypes.rightSample);
      sample.setSampleType(sampleTypes.leftSample);
    } else if (type === sampleTypes.linkedSample) {
      this.setSampleType(sampleTypes.linkedSample);
      sample.setSampleType(sampleTypes.linkedSample);
    } else {
      throw new Error("Invalid sample type: " + type);
    }
  }
  linkTo(instrument) {
    this.linkedTo.push(instrument);
  }
  unlinkFrom(instrument) {
    const index = this.linkedTo.indexOf(instrument);
    if (index < 0) {
      SpessaSynthWarn(`Cannot unlink ${instrument.name} from ${this.name}: not linked.`);
      return;
    }
    this.linkedTo.splice(index, 1);
  }
  getAudioData() {
    if (this.audioData) {
      return this.audioData;
    }
    if (this.isCompressed) {
      this.audioData = this.decodeVorbis();
      return this.audioData;
    }
    throw new Error("Sample data is undefined for a BasicSample instance.");
  }
  setAudioData(audioData, sampleRate) {
    this.audioData = audioData;
    this.sampleRate = sampleRate;
    this.dataOverridden = true;
    this.compressedData = undefined;
  }
  setCompressedData(data) {
    this.audioData = undefined;
    this.compressedData = data;
    this.dataOverridden = false;
  }
  encodeS16LE() {
    const data = this.getAudioData();
    const data16 = new Int16Array(data.length);
    const len = data.length;
    for (let i = 0;i < len; i++) {
      let sample = data[i] * 32768;
      if (sample > 32767) {
        sample = 32767;
      } else if (sample < -32768) {
        sample = -32768;
      }
      data16[i] = sample;
    }
    return new IndexedByteArray(data16.buffer);
  }
  decodeVorbis() {
    if (this.audioData) {
      return this.audioData;
    }
    if (!this.compressedData) {
      throw new Error("Compressed data is missing.");
    }
    try {
      const vorbis = stb.decode(this.compressedData);
      const decoded = vorbis.data[0];
      if (decoded === undefined) {
        SpessaSynthWarn(`Error decoding sample ${this.name}: Vorbis decode returned undefined.`);
        return new Float32Array(0);
      }
      for (let i = 0;i < decoded.length; i++) {
        decoded[i] = Math.max(-1, Math.min(decoded[i], 0.999969482421875));
      }
      return decoded;
    } catch (e) {
      SpessaSynthWarn(`Error decoding sample ${this.name}: ${e}`);
      return new Float32Array(this.loopEnd + 1);
    }
  }
};
var EmptySample = class extends BasicSample {
  constructor() {
    super("", 44100, 60, 0, sampleTypes.monoSample, 0, 0);
  }
};
var SF3_BIT_FLIT = 16;
var SoundFontSample = class extends BasicSample {
  linkedSampleIndex;
  s16leData;
  startByteOffset;
  endByteOffset;
  sampleID;
  constructor(sampleName, sampleStartIndex, sampleEndIndex, sampleLoopStartIndex, sampleLoopEndIndex, sampleRate, samplePitch, samplePitchCorrection, linkedSampleIndex, sampleType, sampleDataArray, sampleIndex) {
    const compressed = (sampleType & SF3_BIT_FLIT) > 0;
    sampleType &= ~SF3_BIT_FLIT;
    super(sampleName, sampleRate, samplePitch, samplePitchCorrection, sampleType, sampleLoopStartIndex - sampleStartIndex / 2, sampleLoopEndIndex - sampleStartIndex / 2);
    this.dataOverridden = false;
    this.name = sampleName;
    this.startByteOffset = sampleStartIndex;
    this.endByteOffset = sampleEndIndex;
    this.sampleID = sampleIndex;
    const smplStart = sampleDataArray instanceof IndexedByteArray ? sampleDataArray.currentIndex : 0;
    if (sampleDataArray instanceof IndexedByteArray) {
      if (compressed) {
        this.loopStart += this.startByteOffset / 2;
        this.loopEnd += this.startByteOffset / 2;
        this.setCompressedData(sampleDataArray.slice(this.startByteOffset / 2 + smplStart, this.endByteOffset / 2 + smplStart));
      } else {
        this.s16leData = sampleDataArray.slice(smplStart + this.startByteOffset, smplStart + this.endByteOffset);
      }
    } else {
      this.setAudioData(sampleDataArray.slice(this.startByteOffset / 2, this.endByteOffset / 2), sampleRate);
    }
    this.linkedSampleIndex = linkedSampleIndex;
  }
  getLinkedSample(samplesArray) {
    if (this.linkedSample || !this.isLinked) {
      return;
    }
    const linked = samplesArray[this.linkedSampleIndex];
    if (!linked) {
      SpessaSynthInfo(`%cInvalid linked sample for ${this.name}. Setting to mono.`, consoleColors.warn);
      this.unlinkSample();
    } else {
      if (linked.linkedSample) {
        SpessaSynthInfo(`%cInvalid linked sample for ${this.name}: ${linked.name} is already linked to ${linked.linkedSample.name}`, consoleColors.warn);
        this.unlinkSample();
      } else {
        this.setLinkedSample(linked, this.sampleType);
      }
    }
  }
  getAudioData() {
    if (this.audioData) {
      return this.audioData;
    }
    if (this.isCompressed) {
      return super.getAudioData();
    }
    if (!this.s16leData) {
      console.error(this);
      throw new Error("Unexpected lack of audio data.");
    }
    const byteLength = this.endByteOffset - this.startByteOffset;
    if (byteLength < 1) {
      SpessaSynthWarn(`Invalid sample ${this.name}! Invalid length: ${byteLength}`);
      return new Float32Array(1);
    }
    const audioData = new Float32Array(byteLength / 2);
    const convertedSigned16 = new Int16Array(this.s16leData.buffer);
    for (let i = 0;i < convertedSigned16.length; i++) {
      audioData[i] = convertedSigned16[i] / 32768;
    }
    this.audioData = audioData;
    return audioData;
  }
  getRawData(allowVorbis) {
    if (this.dataOverridden || this.compressedData) {
      return super.getRawData(allowVorbis);
    }
    return this.s16leData ?? new Uint8Array(0);
  }
};
function readSamples(sampleHeadersChunk, smplChunkData, linkSamples = true) {
  const samples = [];
  let index = 0;
  while (sampleHeadersChunk.data.length > sampleHeadersChunk.data.currentIndex) {
    const sample = readSample(index, sampleHeadersChunk.data, smplChunkData);
    samples.push(sample);
    index++;
  }
  samples.pop();
  if (linkSamples) {
    samples.forEach((s) => s.getLinkedSample(samples));
  }
  return samples;
}
function readSample(index, sampleHeaderData, smplArrayData) {
  const sampleName = readBinaryStringIndexed(sampleHeaderData, 20);
  const sampleStartIndex = readLittleEndianIndexed(sampleHeaderData, 4) * 2;
  const sampleEndIndex = readLittleEndianIndexed(sampleHeaderData, 4) * 2;
  const sampleLoopStartIndex = readLittleEndianIndexed(sampleHeaderData, 4);
  const sampleLoopEndIndex = readLittleEndianIndexed(sampleHeaderData, 4);
  const sampleRate = readLittleEndianIndexed(sampleHeaderData, 4);
  let samplePitch = sampleHeaderData[sampleHeaderData.currentIndex++];
  if (samplePitch > 127) {
    samplePitch = 60;
  }
  const samplePitchCorrection = signedInt8(sampleHeaderData[sampleHeaderData.currentIndex++]);
  const sampleLink = readLittleEndianIndexed(sampleHeaderData, 2);
  const sampleType = readLittleEndianIndexed(sampleHeaderData, 2);
  return new SoundFontSample(sampleName, sampleStartIndex, sampleEndIndex, sampleLoopStartIndex, sampleLoopEndIndex, sampleRate, samplePitch, samplePitchCorrection, sampleLink, sampleType, smplArrayData, index);
}
function getSHDR(bank, smplStartOffsets, smplEndOffsets) {
  const sampleLength = 46;
  const shdrSize = sampleLength * (bank.samples.length + 1);
  const shdrData = new IndexedByteArray(shdrSize);
  const xshdrData = new IndexedByteArray(shdrSize);
  let maxSampleLink = 0;
  bank.samples.forEach((sample, index) => {
    writeBinaryStringIndexed(shdrData, sample.name.substring(0, 20), 20);
    writeBinaryStringIndexed(xshdrData, sample.name.substring(20), 20);
    const dwStart = smplStartOffsets[index];
    writeDword(shdrData, dwStart);
    xshdrData.currentIndex += 4;
    const dwEnd = smplEndOffsets[index];
    writeDword(shdrData, dwEnd);
    xshdrData.currentIndex += 4;
    let loopStart = sample.loopStart + dwStart;
    let loopEnd = sample.loopEnd + dwStart;
    if (sample.isCompressed) {
      loopStart -= dwStart;
      loopEnd -= dwStart;
    }
    writeDword(shdrData, loopStart);
    writeDword(shdrData, loopEnd);
    writeDword(shdrData, sample.sampleRate);
    shdrData[shdrData.currentIndex++] = sample.originalKey;
    shdrData[shdrData.currentIndex++] = sample.pitchCorrection;
    xshdrData.currentIndex += 14;
    const sampleLinkIndex = sample.linkedSample ? bank.samples.indexOf(sample.linkedSample) : 0;
    writeWord(shdrData, Math.max(0, sampleLinkIndex) & 65535);
    writeWord(xshdrData, Math.max(0, sampleLinkIndex) >> 16);
    maxSampleLink = Math.max(maxSampleLink, sampleLinkIndex);
    let type = sample.sampleType;
    if (sample.isCompressed) {
      type |= SF3_BIT_FLIT;
    }
    writeWord(shdrData, type);
    xshdrData.currentIndex += 2;
  });
  writeBinaryStringIndexed(shdrData, "EOS", sampleLength);
  writeBinaryStringIndexed(xshdrData, "EOS", sampleLength);
  const shdr = writeRIFFChunkRaw("shdr", shdrData);
  const xshdr = writeRIFFChunkRaw("shdr", xshdrData);
  return {
    pdta: shdr,
    xdta: xshdr
  };
}
function writeSF2Elements(bank, isPreset = false) {
  const elements = isPreset ? bank.presets : bank.instruments;
  const genHeader = isPreset ? "pgen" : "igen";
  const modHeader = isPreset ? "pmod" : "imod";
  const bagHeader = isPreset ? "pbag" : "ibag";
  const hdrHeader = isPreset ? "phdr" : "inst";
  const hdrByteSize = isPreset ? PHDR_BYTE_SIZE : INST_BYTE_SIZE;
  let currentGenIndex = 0;
  const generatorIndexes = new Array;
  let currentModIndex = 0;
  const modulatorIndexes = new Array;
  const generators = new Array;
  const modulators = new Array;
  let zoneIndex = 0;
  const zoneIndexes = new Array;
  const writeZone = (z) => {
    generatorIndexes.push(currentGenIndex);
    const gens = z.getWriteGenerators(bank);
    currentGenIndex += gens.length;
    generators.push(...gens);
    modulatorIndexes.push(currentModIndex);
    const mods = z.modulators;
    currentModIndex += mods.length;
    modulators.push(...mods);
  };
  elements.forEach((el) => {
    zoneIndexes.push(zoneIndex);
    writeZone(el.globalZone);
    el.zones.forEach(writeZone);
    zoneIndex += el.zones.length + 1;
  });
  generators.push(new Generator(0, 0, false));
  modulators.push(new DecodedModulator(0, 0, 0, 0, 0));
  generatorIndexes.push(currentGenIndex);
  modulatorIndexes.push(currentModIndex);
  zoneIndexes.push(zoneIndex);
  const genSize = generators.length * GEN_BYTE_SIZE;
  const genData = new IndexedByteArray(genSize);
  generators.forEach((g) => g.write(genData));
  const modSize = modulators.length * MOD_BYTE_SIZE;
  const modData = new IndexedByteArray(modSize);
  modulators.forEach((m) => m.write(modData));
  const bagSize = modulatorIndexes.length * BAG_BYTE_SIZE;
  const bagData = {
    pdta: new IndexedByteArray(bagSize),
    xdta: new IndexedByteArray(bagSize)
  };
  modulatorIndexes.forEach((modulatorIndex, i) => {
    const generatorIndex = generatorIndexes[i];
    writeWord(bagData.pdta, generatorIndex & 65535);
    writeWord(bagData.pdta, modulatorIndex & 65535);
    writeWord(bagData.xdta, generatorIndex >> 16);
    writeWord(bagData.xdta, modulatorIndex >> 16);
  });
  const hdrSize = (elements.length + 1) * hdrByteSize;
  const hdrData = {
    pdta: new IndexedByteArray(hdrSize),
    xdta: new IndexedByteArray(hdrSize)
  };
  elements.forEach((el, i) => el.write(hdrData, zoneIndexes[i]));
  if (isPreset) {
    writeBinaryStringIndexed(hdrData.pdta, "EOP", 20);
    hdrData.pdta.currentIndex += 4;
    writeWord(hdrData.pdta, zoneIndex & 65535);
    hdrData.pdta.currentIndex += 12;
    writeBinaryStringIndexed(hdrData.xdta, "", 20);
    hdrData.xdta.currentIndex += 4;
    writeWord(hdrData.xdta, zoneIndex >> 16);
    hdrData.xdta.currentIndex += 12;
  } else {
    writeBinaryStringIndexed(hdrData.pdta, "EOI", 20);
    writeWord(hdrData.pdta, zoneIndex & 65535);
    writeBinaryStringIndexed(hdrData.xdta, "", 20);
    writeWord(hdrData.xdta, zoneIndex >> 16);
  }
  return {
    writeXdta: Math.max(currentGenIndex, currentModIndex, zoneIndex) > 65535,
    gen: {
      pdta: writeRIFFChunkRaw(genHeader, genData),
      xdta: writeRIFFChunkRaw(modHeader, new IndexedByteArray(GEN_BYTE_SIZE))
    },
    mod: {
      pdta: writeRIFFChunkRaw(modHeader, modData),
      xdta: writeRIFFChunkRaw(modHeader, new IndexedByteArray(MOD_BYTE_SIZE))
    },
    bag: {
      pdta: writeRIFFChunkRaw(bagHeader, bagData.pdta),
      xdta: writeRIFFChunkRaw(bagHeader, bagData.xdta)
    },
    hdr: {
      pdta: writeRIFFChunkRaw(hdrHeader, hdrData.pdta),
      xdta: writeRIFFChunkRaw(hdrHeader, hdrData.xdta)
    }
  };
}
var DEFAULT_SF2_WRITE_OPTIONS = {
  compress: false,
  compressionFunction: undefined,
  progressFunction: undefined,
  writeDefaultModulators: true,
  writeExtendedLimits: true,
  decompress: false
};
async function writeSF2Internal(bank, writeOptions = DEFAULT_SF2_WRITE_OPTIONS) {
  const options = fillWithDefaults(writeOptions, DEFAULT_SF2_WRITE_OPTIONS);
  if (options?.compress) {
    if (typeof options?.compressionFunction !== "function") {
      throw new Error("No compression function supplied but compression enabled.");
    }
    if (options?.decompress) {
      throw new Error("Decompressed and compressed at the same time.");
    }
  }
  SpessaSynthGroupCollapsed("%cSaving soundbank...", consoleColors.info);
  SpessaSynthInfo(`%cCompression: %c${options?.compress || "false"}%c`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
  SpessaSynthGroup("%cWriting INFO...", consoleColors.info);
  const infoArrays = [];
  bank.soundBankInfo.software = "SpessaSynth";
  if (options?.compress || bank.samples.some((s) => s.isCompressed)) {
    bank.soundBankInfo.version.major = 3;
    bank.soundBankInfo.version.minor = 0;
  }
  if (options?.decompress) {
    bank.soundBankInfo.version.major = 2;
    bank.soundBankInfo.version.minor = 4;
  }
  const writeSF2Info = (type, data) => {
    infoArrays.push(writeRIFFChunkRaw(type, getStringBytes(data, true, true)));
  };
  const ifilData = new IndexedByteArray(4);
  writeWord(ifilData, bank.soundBankInfo.version.major);
  writeWord(ifilData, bank.soundBankInfo.version.minor);
  infoArrays.push(writeRIFFChunkRaw("ifil", ifilData));
  if (bank.soundBankInfo.romVersion) {
    const ifilData2 = new IndexedByteArray(4);
    writeWord(ifilData2, bank.soundBankInfo.romVersion.major);
    writeWord(ifilData2, bank.soundBankInfo.romVersion.minor);
    infoArrays.push(writeRIFFChunkRaw("iver", ifilData2));
  }
  const commentText = (bank.soundBankInfo?.comment ?? "") + (bank.soundBankInfo.subject ? `
${bank.soundBankInfo.subject}` : "");
  for (const [t, d] of Object.entries(bank.soundBankInfo)) {
    const type = t;
    const data = d;
    if (!data) {
      continue;
    }
    switch (type) {
      case "name":
        writeSF2Info("INAM", data);
        break;
      case "comment":
        writeSF2Info("ICMT", commentText);
        break;
      case "copyright":
        writeSF2Info("ICOP", data);
        break;
      case "creationDate":
        writeSF2Info("ICRD", data.toISOString());
        break;
      case "engineer":
        writeSF2Info("IENG", data);
        break;
      case "product":
        writeSF2Info("IPRD", data);
        break;
      case "romInfo":
        writeSF2Info("irom", data);
        break;
      case "software":
        writeSF2Info("ISFT", data);
        break;
      case "soundEngine":
        writeSF2Info("isng", data);
        break;
      case "subject":
        break;
    }
  }
  const unchangedDefaultModulators = bank.defaultModulators.some((mod) => SPESSASYNTH_DEFAULT_MODULATORS.findIndex((m) => Modulator.isIdentical(m, mod, true)) === -1);
  if (unchangedDefaultModulators && options?.writeDefaultModulators) {
    const mods = bank.defaultModulators;
    SpessaSynthInfo(`%cWriting %c${mods.length}%c default modulators...`, consoleColors.info, consoleColors.recognized, consoleColors.info);
    const dmodSize = MOD_BYTE_SIZE + mods.length * MOD_BYTE_SIZE;
    const dmodData = new IndexedByteArray(dmodSize);
    for (const mod of mods) {
      mod.write(dmodData);
    }
    writeLittleEndianIndexed(dmodData, 0, MOD_BYTE_SIZE);
    infoArrays.push(writeRIFFChunkRaw("DMOD", dmodData));
  }
  SpessaSynthGroupEnd();
  SpessaSynthInfo("%cWriting SDTA...", consoleColors.info);
  const smplStartOffsets = [];
  const smplEndOffsets = [];
  const sdtaChunk = await getSDTA(bank, smplStartOffsets, smplEndOffsets, options.compress, options.decompress, options?.compressionFunction, options?.progressFunction);
  SpessaSynthInfo("%cWriting PDTA...", consoleColors.info);
  SpessaSynthInfo("%cWriting SHDR...", consoleColors.info);
  const shdrChunk = getSHDR(bank, smplStartOffsets, smplEndOffsets);
  SpessaSynthGroup("%cWriting instruments...", consoleColors.info);
  const instData = writeSF2Elements(bank, false);
  SpessaSynthGroupEnd();
  SpessaSynthGroup("%cWriting presets...", consoleColors.info);
  const presData = writeSF2Elements(bank, true);
  SpessaSynthGroupEnd();
  const chunks = [
    presData.hdr,
    presData.bag,
    presData.mod,
    presData.gen,
    instData.hdr,
    instData.bag,
    instData.mod,
    instData.gen,
    shdrChunk
  ];
  const pdtaChunk = writeRIFFChunkParts("pdta", chunks.map((c) => c.pdta), true);
  const writeXdta = options.writeExtendedLimits && (instData.writeXdta || presData.writeXdta || bank.presets.some((p) => p.name.length > 20) || bank.instruments.some((i) => i.name.length > 20) || bank.samples.some((s) => s.name.length > 20));
  if (writeXdta) {
    SpessaSynthInfo(`%cWriting the xdta chunk as writeExendedLimits is enabled and at least one condition was met.`, consoleColors.info, consoleColors.value);
    const xpdtaChunk = writeRIFFChunkParts("xdta", chunks.map((c) => c.xdta), true);
    infoArrays.push(xpdtaChunk);
  }
  const infoChunk = writeRIFFChunkParts("INFO", infoArrays, true);
  SpessaSynthInfo("%cWriting the output file...", consoleColors.info);
  const main = writeRIFFChunkParts("RIFF", [
    getStringBytes("sfbk"),
    infoChunk,
    sdtaChunk,
    pdtaChunk
  ]);
  SpessaSynthInfo(`%cSaved succesfully! Final file size: %c${main.length}`, consoleColors.info, consoleColors.recognized);
  SpessaSynthGroupEnd();
  return main.buffer;
}
var DLSVerifier = class {
  static verifyHeader(chunk, ...expected) {
    for (const expect of expected) {
      if (chunk.header.toLowerCase() === expect.toLowerCase()) {
        return;
      }
    }
    this.parsingError(`Invalid DLS chunk header! Expected "${expected.join(", or ")}" got "${chunk.header.toLowerCase()}"`);
  }
  static verifyText(text, ...expected) {
    for (const expect of expected) {
      if (text.toLowerCase() === expect.toLowerCase()) {
        return;
      }
    }
    this.parsingError(`FourCC error: Expected "${expected.join(", or ")}" got "${text.toLowerCase()}"`);
  }
  static parsingError(error) {
    SpessaSynthGroupEnd();
    throw new Error(`DLS parse error: ${error} The file may be corrupted.`);
  }
  static verifyAndReadList(chunk, ...type) {
    this.verifyHeader(chunk, "LIST");
    chunk.data.currentIndex = 0;
    this.verifyText(readBinaryStringIndexed(chunk.data, 4), ...type);
    const chunks = [];
    while (chunk.data.length > chunk.data.currentIndex) {
      chunks.push(readRIFFChunk(chunk.data));
    }
    return chunks;
  }
};
var WSMP_SIZE = 20;
var WSMP_LOOP_SIZE = 16;
var WaveSample = class _WaveSample extends DLSVerifier {
  gain = 0;
  unityNote = 60;
  fineTune = 0;
  loops = new Array;
  fulOptions = 2;
  static copyFrom(inputWaveSample) {
    const outputWaveSample = new _WaveSample;
    outputWaveSample.unityNote = inputWaveSample.unityNote;
    outputWaveSample.gain = inputWaveSample.gain;
    outputWaveSample.fineTune = inputWaveSample.fineTune;
    outputWaveSample.loops = inputWaveSample.loops.map((l) => {
      return { ...l };
    });
    outputWaveSample.fulOptions = inputWaveSample.fulOptions;
    return outputWaveSample;
  }
  static read(chunk) {
    this.verifyHeader(chunk, "wsmp");
    const waveSample = new _WaveSample;
    const cbSize = readLittleEndianIndexed(chunk.data, 4);
    if (cbSize !== WSMP_SIZE) {
      SpessaSynthWarn(`Wsmp cbSize mismatch: got ${cbSize}, expected ${WSMP_SIZE}.`);
    }
    waveSample.unityNote = readLittleEndianIndexed(chunk.data, 2);
    waveSample.fineTune = signedInt16(chunk.data[chunk.data.currentIndex++], chunk.data[chunk.data.currentIndex++]);
    waveSample.gain = readLittleEndianIndexed(chunk.data, 4) | 0;
    waveSample.fulOptions = readLittleEndianIndexed(chunk.data, 4);
    const loopsAmount = readLittleEndianIndexed(chunk.data, 4);
    if (loopsAmount === 0) {} else {
      const cbSize2 = readLittleEndianIndexed(chunk.data, 4);
      if (cbSize2 !== WSMP_LOOP_SIZE) {
        SpessaSynthWarn(`CbSize for loop in wsmp mismatch. Expected ${WSMP_SIZE}, got ${cbSize2}.`);
      }
      const loopType = readLittleEndianIndexed(chunk.data, 4);
      const loopStart = readLittleEndianIndexed(chunk.data, 4);
      const loopLength = readLittleEndianIndexed(chunk.data, 4);
      waveSample.loops.push({
        loopStart,
        loopLength,
        loopType
      });
    }
    return waveSample;
  }
  static fromSFSample(sample) {
    const waveSample = new _WaveSample;
    waveSample.unityNote = sample.originalKey;
    waveSample.fineTune = sample.pitchCorrection;
    if (sample.loopEnd !== 0 || sample.loopStart !== 0) {
      waveSample.loops.push({
        loopStart: sample.loopStart,
        loopLength: sample.loopEnd - sample.loopStart,
        loopType: DLSLoopTypes.forward
      });
    }
    return waveSample;
  }
  static fromSFZone(zone) {
    const waveSample = new _WaveSample;
    waveSample.unityNote = zone.getGenerator(generatorTypes.overridingRootKey, zone.sample.originalKey);
    if (zone.getGenerator(generatorTypes.scaleTuning, 100) === 0 && zone.keyRange.max - zone.keyRange.min === 0) {
      waveSample.unityNote = zone.keyRange.min;
    }
    waveSample.fineTune = zone.fineTuning + zone.sample.pitchCorrection;
    const attenuationCb = zone.getGenerator(generatorTypes.initialAttenuation, 0) * 0.4;
    waveSample.gain = -attenuationCb << 16;
    const loopingMode = zone.getGenerator(generatorTypes.sampleModes, 0);
    if (loopingMode !== 0) {
      const loopStart = zone.sample.loopStart + zone.getGenerator(generatorTypes.startloopAddrsOffset, 0) + zone.getGenerator(generatorTypes.startloopAddrsCoarseOffset, 0) * 32768;
      const loopEnd = zone.sample.loopEnd + zone.getGenerator(generatorTypes.endloopAddrsOffset, 0) + zone.getGenerator(generatorTypes.endloopAddrsCoarseOffset, 0) * 32768;
      let dlsLoopType;
      switch (loopingMode) {
        case 1:
        default:
          dlsLoopType = 0;
          break;
        case 3:
          dlsLoopType = 1;
      }
      waveSample.loops.push({
        loopType: dlsLoopType,
        loopStart,
        loopLength: loopEnd - loopStart
      });
    }
    return waveSample;
  }
  toSFZone(zone, sample) {
    let loopingMode = 0;
    const loop = this.loops[0];
    if (loop) {
      loopingMode = loop.loopType === DLSLoopTypes.loopAndRelease ? 3 : 1;
    }
    if (loopingMode !== 0) {
      zone.setGenerator(generatorTypes.sampleModes, loopingMode);
    }
    const wsmpGain16 = this.gain >> 16;
    const wsmpAttenuation = -wsmpGain16;
    const wsmpAttenuationCorrected = wsmpAttenuation / 0.4;
    if (wsmpAttenuationCorrected !== 0) {
      zone.setGenerator(generatorTypes.initialAttenuation, wsmpAttenuationCorrected);
    }
    zone.fineTuning = this.fineTune - sample.pitchCorrection;
    if (this.unityNote !== sample.originalKey) {
      zone.setGenerator(generatorTypes.overridingRootKey, this.unityNote);
    }
    if (loop) {
      const diffStart = loop.loopStart - sample.loopStart;
      const loopEnd = loop.loopStart + loop.loopLength;
      const diffEnd = loopEnd - sample.loopEnd;
      if (diffStart !== 0) {
        const fine = diffStart % 32768;
        zone.setGenerator(generatorTypes.startloopAddrsOffset, fine);
        const coarse = Math.trunc(diffStart / 32768);
        if (coarse !== 0) {
          zone.setGenerator(generatorTypes.startloopAddrsCoarseOffset, coarse);
        }
      }
      if (diffEnd !== 0) {
        const fine = diffEnd % 32768;
        zone.setGenerator(generatorTypes.endloopAddrsOffset, fine);
        const coarse = Math.trunc(diffEnd / 32768);
        if (coarse !== 0) {
          zone.setGenerator(generatorTypes.endloopAddrsCoarseOffset, coarse);
        }
      }
    }
  }
  write() {
    const wsmpData = new IndexedByteArray(WSMP_SIZE + this.loops.length * WSMP_LOOP_SIZE);
    writeDword(wsmpData, WSMP_SIZE);
    writeWord(wsmpData, this.unityNote);
    writeWord(wsmpData, this.fineTune);
    writeDword(wsmpData, this.gain);
    writeDword(wsmpData, this.fulOptions);
    writeDword(wsmpData, this.loops.length);
    this.loops.forEach((loop) => {
      writeDword(wsmpData, WSMP_LOOP_SIZE);
      writeDword(wsmpData, loop.loopType);
      writeDword(wsmpData, loop.loopStart);
      writeDword(wsmpData, loop.loopLength);
    });
    return writeRIFFChunkRaw("wsmp", wsmpData);
  }
};
var W_FORMAT_TAG = {
  PCM: 1,
  ALAW: 6
};
function readPCM(data, bytesPerSample) {
  const maxSampleValue = Math.pow(2, bytesPerSample * 8 - 1);
  const maxUnsigned = Math.pow(2, bytesPerSample * 8);
  let normalizationFactor;
  let isUnsigned = false;
  if (bytesPerSample === 1) {
    normalizationFactor = 255;
    isUnsigned = true;
  } else {
    normalizationFactor = maxSampleValue;
  }
  const sampleLength = data.length / bytesPerSample;
  const sampleData = new Float32Array(sampleLength);
  if (bytesPerSample === 2) {
    const s16 = new Int16Array(data.buffer);
    for (let i = 0;i < s16.length; i++) {
      sampleData[i] = s16[i] / 32768;
    }
  } else {
    for (let i = 0;i < sampleData.length; i++) {
      let sample = readLittleEndianIndexed(data, bytesPerSample);
      if (isUnsigned) {
        sampleData[i] = sample / normalizationFactor - 0.5;
      } else {
        if (sample >= maxSampleValue) {
          sample -= maxUnsigned;
        }
        sampleData[i] = sample / normalizationFactor;
      }
    }
  }
  return sampleData;
}
function readALAW(data, bytesPerSample) {
  const sampleLength = data.length / bytesPerSample;
  const sampleData = new Float32Array(sampleLength);
  for (let i = 0;i < sampleData.length; i++) {
    const input = readLittleEndianIndexed(data, bytesPerSample);
    let sample = input ^ 85;
    sample &= 127;
    const exponent = sample >> 4;
    let mantissa = sample & 15;
    if (exponent > 0) {
      mantissa += 16;
    }
    mantissa = (mantissa << 4) + 8;
    if (exponent > 1) {
      mantissa = mantissa << exponent - 1;
    }
    const s16sample = input > 127 ? mantissa : -mantissa;
    sampleData[i] = s16sample / 32678;
  }
  return sampleData;
}
var DLSSample = class extends BasicSample {
  wFormatTag;
  bytesPerSample;
  rawData;
  constructor(name, rate, pitch, pitchCorrection, loopStart, loopEnd, dataChunk, wFormatTag, bytesPerSample) {
    super(name, rate, pitch, pitchCorrection, sampleTypes.monoSample, loopStart, loopEnd);
    this.dataOverridden = false;
    this.rawData = dataChunk.data;
    this.wFormatTag = wFormatTag;
    this.bytesPerSample = bytesPerSample;
  }
  getAudioData() {
    if (!this.rawData) {
      return new Float32Array(0);
    }
    if (!this.audioData) {
      let sampleData;
      switch (this.wFormatTag) {
        default:
          SpessaSynthWarn(`Failed to decode sample. Unknown wFormatTag: ${this.wFormatTag}`);
          sampleData = new Float32Array(this.rawData.length / this.bytesPerSample);
          break;
        case W_FORMAT_TAG.PCM:
          sampleData = readPCM(this.rawData, this.bytesPerSample);
          break;
        case W_FORMAT_TAG.ALAW:
          sampleData = readALAW(this.rawData, this.bytesPerSample);
          break;
      }
      this.setAudioData(sampleData, this.sampleRate);
    }
    return this.audioData ?? new Float32Array(0);
  }
  getRawData(allowVorbis) {
    if (this.dataOverridden || this.isCompressed) {
      return super.getRawData(allowVorbis);
    }
    if (this.wFormatTag === W_FORMAT_TAG.PCM && this.bytesPerSample === 2) {
      return this.rawData;
    }
    return this.encodeS16LE();
  }
};
var DownloadableSoundsSample = class _DownloadableSoundsSample extends DLSVerifier {
  waveSample = new WaveSample;
  wFormatTag;
  bytesPerSample;
  sampleRate;
  dataChunk;
  name = "Unnamed sample";
  constructor(wFormatTag, bytesPerSample, sampleRate, dataChunk) {
    super();
    this.wFormatTag = wFormatTag;
    this.bytesPerSample = bytesPerSample;
    this.sampleRate = sampleRate;
    this.dataChunk = dataChunk;
  }
  static read(waveChunk) {
    const chunks = this.verifyAndReadList(waveChunk, "wave");
    const fmtChunk = chunks.find((c) => c.header === "fmt ");
    if (!fmtChunk) {
      throw new Error("No fmt chunk in the wave file!");
    }
    const wFormatTag = readLittleEndianIndexed(fmtChunk.data, 2);
    const channelsAmount = readLittleEndianIndexed(fmtChunk.data, 2);
    if (channelsAmount !== 1) {
      throw new Error(`Only mono samples are supported. Fmt reports ${channelsAmount} channels.`);
    }
    const sampleRate = readLittleEndianIndexed(fmtChunk.data, 4);
    readLittleEndianIndexed(fmtChunk.data, 4);
    readLittleEndianIndexed(fmtChunk.data, 2);
    const wBitsPerSample = readLittleEndianIndexed(fmtChunk.data, 2);
    const bytesPerSample = wBitsPerSample / 8;
    const dataChunk = chunks.find((c) => c.header === "data");
    if (!dataChunk) {
      throw new Error("No data chunk in the WAVE chunk!");
    }
    const sample = new _DownloadableSoundsSample(wFormatTag, bytesPerSample, sampleRate, dataChunk);
    const waveInfo = findRIFFListType(chunks, "INFO");
    if (waveInfo) {
      let infoChunk = readRIFFChunk(waveInfo.data);
      while (infoChunk.header !== "INAM" && waveInfo.data.currentIndex < waveInfo.data.length) {
        infoChunk = readRIFFChunk(waveInfo.data);
      }
      if (infoChunk.header === "INAM") {
        sample.name = readBinaryStringIndexed(infoChunk.data, infoChunk.size).trim();
      }
    }
    const wsmpChunk = chunks.find((c) => c.header === "wsmp");
    if (wsmpChunk) {
      sample.waveSample = WaveSample.read(wsmpChunk);
    }
    return sample;
  }
  static fromSFSample(sample) {
    const raw = sample.getRawData(false);
    const dlsSample = new _DownloadableSoundsSample(1, 2, sample.sampleRate, new RIFFChunk("data", raw.length, new IndexedByteArray(raw.buffer)));
    dlsSample.name = sample.name;
    dlsSample.waveSample = WaveSample.fromSFSample(sample);
    return dlsSample;
  }
  toSFSample(soundBank) {
    let originalKey = this.waveSample.unityNote;
    let pitchCorrection = this.waveSample.fineTune;
    const samplePitchSemitones = Math.trunc(pitchCorrection / 100);
    originalKey += samplePitchSemitones;
    pitchCorrection -= samplePitchSemitones * 100;
    let loopStart = 0;
    let loopEnd = 0;
    const loop = this.waveSample.loops?.[0];
    if (loop) {
      loopStart = loop.loopStart;
      loopEnd = loop.loopStart + loop.loopLength;
    }
    const sample = new DLSSample(this.name, this.sampleRate, originalKey, pitchCorrection, loopStart, loopEnd, this.dataChunk, this.wFormatTag, this.bytesPerSample);
    soundBank.addSamples(sample);
  }
  write() {
    const fmt = this.writeFmt();
    const wsmp = this.waveSample.write();
    const data = writeRIFFChunkRaw("data", this.dataChunk.data);
    const inam = writeRIFFChunkRaw("INAM", getStringBytes(this.name, true));
    const info = writeRIFFChunkRaw("INFO", inam, false, true);
    SpessaSynthInfo(`%cSaved %c${this.name}%c successfully!`, consoleColors.recognized, consoleColors.value, consoleColors.recognized);
    return writeRIFFChunkParts("wave", [fmt, wsmp, data, info], true);
  }
  writeFmt() {
    const fmtData = new IndexedByteArray(18);
    writeWord(fmtData, this.wFormatTag);
    writeWord(fmtData, 1);
    writeDword(fmtData, this.sampleRate);
    writeDword(fmtData, this.sampleRate * 2);
    writeWord(fmtData, 2);
    writeWord(fmtData, this.bytesPerSample * 8);
    return writeRIFFChunkRaw("fmt ", fmtData);
  }
};
var DEFAULT_DLS_REVERB = new DecodedModulator(219, 0, generatorTypes.reverbEffectsSend, 1000, 0);
var DEFAULT_DLS_CHORUS = new DecodedModulator(221, 0, generatorTypes.chorusEffectsSend, 1000, 0);
var DLS_1_NO_VIBRATO_MOD = new DecodedModulator(129, 0, generatorTypes.vibLfoToPitch, 0, 0);
var DLS_1_NO_VIBRATO_PRESSURE = new DecodedModulator(13, 0, generatorTypes.vibLfoToPitch, 0, 0);
var ConnectionSource = class _ConnectionSource {
  source;
  transform;
  bipolar;
  invert;
  constructor(source = dlsSources.none, transform = modulatorCurveTypes.linear, bipolar = false, invert = false) {
    this.source = source;
    this.transform = transform;
    this.bipolar = bipolar;
    this.invert = invert;
  }
  get sourceName() {
    return Object.keys(dlsSources).find((k) => dlsSources[k] === this.source) ?? this.source.toString();
  }
  get transformName() {
    return Object.keys(modulatorCurveTypes).find((k) => modulatorCurveTypes[k] === this.transform) ?? this.transform.toString();
  }
  static copyFrom(inputSource) {
    return new _ConnectionSource(inputSource.source, inputSource.transform, inputSource.bipolar, inputSource.invert);
  }
  static fromSFSource(source) {
    let sourceEnum = undefined;
    if (source.isCC) {
      switch (source.index) {
        case midiControllers.modulationWheel:
          sourceEnum = dlsSources.modulationWheel;
          break;
        case midiControllers.mainVolume:
          sourceEnum = dlsSources.volume;
          break;
        case midiControllers.pan:
          sourceEnum = dlsSources.pan;
          break;
        case midiControllers.expressionController:
          sourceEnum = dlsSources.expression;
          break;
        case midiControllers.chorusDepth:
          sourceEnum = dlsSources.chorus;
          break;
        case midiControllers.reverbDepth:
          sourceEnum = dlsSources.reverb;
          break;
      }
    } else {
      switch (source.index) {
        case modulatorSources.noController:
          sourceEnum = dlsSources.none;
          break;
        case modulatorSources.noteOnKeyNum:
          sourceEnum = dlsSources.keyNum;
          break;
        case modulatorSources.noteOnVelocity:
          sourceEnum = dlsSources.velocity;
          break;
        case modulatorSources.pitchWheel:
          sourceEnum = dlsSources.pitchWheel;
          break;
        case modulatorSources.pitchWheelRange:
          sourceEnum = dlsSources.pitchWheelRange;
          break;
        case modulatorSources.polyPressure:
          sourceEnum = dlsSources.polyPressure;
          break;
        case modulatorSources.channelPressure:
          sourceEnum = dlsSources.channelPressure;
      }
    }
    if (sourceEnum === undefined) {
      return;
    }
    return new _ConnectionSource(sourceEnum, source.curveType, source.isBipolar, source.isNegative);
  }
  toString() {
    return `${this.sourceName} ${this.transformName} ${this.bipolar ? "bipolar" : "unipolar"} ${this.invert ? "inverted" : "positive"}`;
  }
  toTransformFlag() {
    return this.transform | (this.bipolar ? 1 : 0) << 4 | (this.invert ? 1 : 0) << 5;
  }
  toSFSource() {
    let sourceEnum = undefined;
    let isCC = false;
    switch (this.source) {
      default:
      case dlsSources.modLfo:
      case dlsSources.vibratoLfo:
      case dlsSources.coarseTune:
      case dlsSources.fineTune:
      case dlsSources.modEnv:
        return;
      case dlsSources.keyNum:
        sourceEnum = modulatorSources.noteOnKeyNum;
        break;
      case dlsSources.none:
        sourceEnum = modulatorSources.noController;
        break;
      case dlsSources.modulationWheel:
        sourceEnum = midiControllers.modulationWheel;
        isCC = true;
        break;
      case dlsSources.pan:
        sourceEnum = midiControllers.pan;
        isCC = true;
        break;
      case dlsSources.reverb:
        sourceEnum = midiControllers.reverbDepth;
        isCC = true;
        break;
      case dlsSources.chorus:
        sourceEnum = midiControllers.chorusDepth;
        isCC = true;
        break;
      case dlsSources.expression:
        sourceEnum = midiControllers.expressionController;
        isCC = true;
        break;
      case dlsSources.volume:
        sourceEnum = midiControllers.mainVolume;
        isCC = true;
        break;
      case dlsSources.velocity:
        sourceEnum = modulatorSources.noteOnVelocity;
        break;
      case dlsSources.polyPressure:
        sourceEnum = modulatorSources.polyPressure;
        break;
      case dlsSources.channelPressure:
        sourceEnum = modulatorSources.channelPressure;
        break;
      case dlsSources.pitchWheel:
        sourceEnum = modulatorSources.pitchWheel;
        break;
      case dlsSources.pitchWheelRange:
        sourceEnum = modulatorSources.pitchWheelRange;
        break;
    }
    if (sourceEnum === undefined) {
      return;
    }
    return new ModulatorSource(sourceEnum, this.transform, isCC, this.bipolar, this.invert);
  }
};
var invalidGeneratorTypes = /* @__PURE__ */ new Set([
  generatorTypes.sampleModes,
  generatorTypes.initialAttenuation,
  generatorTypes.keyRange,
  generatorTypes.velRange,
  generatorTypes.sampleID,
  generatorTypes.fineTune,
  generatorTypes.coarseTune,
  generatorTypes.startAddrsOffset,
  generatorTypes.startAddrsCoarseOffset,
  generatorTypes.endAddrOffset,
  generatorTypes.endAddrsCoarseOffset,
  generatorTypes.startloopAddrsOffset,
  generatorTypes.startloopAddrsCoarseOffset,
  generatorTypes.endloopAddrsOffset,
  generatorTypes.endloopAddrsCoarseOffset,
  generatorTypes.overridingRootKey,
  generatorTypes.exclusiveClass
]);
var ConnectionBlock = class _ConnectionBlock {
  source;
  control;
  destination;
  scale;
  transform;
  constructor(source = new ConnectionSource, control = new ConnectionSource, destination, transform, scale) {
    this.source = source;
    this.control = control;
    this.destination = destination;
    this.transform = transform;
    this.scale = scale;
  }
  get isStaticParameter() {
    return this.source.source === dlsSources.none && this.control.source === dlsSources.none;
  }
  get shortScale() {
    return this.scale >> 16;
  }
  get transformName() {
    return Object.keys(modulatorCurveTypes).find((k) => modulatorCurveTypes[k] === this.transform) ?? this.transform.toString();
  }
  get destinationName() {
    return Object.keys(dlsDestinations).find((k) => dlsDestinations[k] === this.destination) ?? this.destination.toString();
  }
  static read(artData) {
    const usSource = readLittleEndianIndexed(artData, 2);
    const usControl = readLittleEndianIndexed(artData, 2);
    const usDestination = readLittleEndianIndexed(artData, 2);
    const usTransform = readLittleEndianIndexed(artData, 2);
    const lScale = readLittleEndianIndexed(artData, 4) | 0;
    const transform = usTransform & 15;
    const controlTransform = usTransform >> 4 & 15;
    const controlBipolar = bitMaskToBool(usTransform, 8);
    const controlInvert = bitMaskToBool(usTransform, 9);
    const control = new ConnectionSource(usControl, controlTransform, controlBipolar, controlInvert);
    const sourceTransform = usTransform >> 10 & 15;
    const sourceBipolar = bitMaskToBool(usTransform, 14);
    const sourceInvert = bitMaskToBool(usTransform, 15);
    const source = new ConnectionSource(usSource, sourceTransform, sourceBipolar, sourceInvert);
    return new _ConnectionBlock(source, control, usDestination, transform, lScale);
  }
  static fromSFModulator(m, articulation) {
    const failed = (msg) => {
      SpessaSynthWarn(`Failed converting SF modulator into DLS:
 ${m.toString()} 
(${msg})`);
    };
    if (m.transformType !== 0) {
      failed("Absolute transform type is not supported");
      return;
    }
    if (Modulator.isIdentical(m, DEFAULT_DLS_CHORUS, true) || Modulator.isIdentical(m, DEFAULT_DLS_REVERB, true)) {
      return;
    }
    let source = ConnectionSource.fromSFSource(m.primarySource);
    if (!source) {
      failed("Invalid primary source");
      return;
    }
    let control = ConnectionSource.fromSFSource(m.secondarySource);
    if (!control) {
      failed("Invalid secondary source");
      return;
    }
    const dlsDestination = _ConnectionBlock.fromSFDestination(m.destination, m.transformAmount);
    if (dlsDestination === undefined) {
      failed("Invalid destination");
      return;
    }
    let amount = m.transformAmount;
    let destination;
    if (typeof dlsDestination === "number") {
      destination = dlsDestination;
    } else {
      destination = dlsDestination.destination;
      amount = dlsDestination.amount;
      if (dlsDestination.source !== dlsSources.none) {
        if (control.source !== dlsSources.none && source.source !== dlsSources.none) {
          failed("Articulation generators with secondary source are not supported");
          return;
        }
        if (source.source !== dlsSources.none) {
          control = source;
        }
        source = new ConnectionSource(dlsDestination.source, modulatorCurveTypes.linear, dlsDestination.isBipolar);
      }
    }
    const bloc = new _ConnectionBlock(source, control, destination, 0, amount << 16);
    articulation.connectionBlocks.push(bloc);
  }
  static copyFrom(inputBlock) {
    return new _ConnectionBlock(ConnectionSource.copyFrom(inputBlock.source), ConnectionSource.copyFrom(inputBlock.control), inputBlock.destination, inputBlock.transform, inputBlock.scale);
  }
  static fromSFGenerator(generator, articulation) {
    if (invalidGeneratorTypes.has(generator.generatorType)) {
      return;
    }
    const failed = (msg) => {
      SpessaSynthWarn(`Failed converting SF2 generator into DLS:
 ${generator.toString()} 
(${msg})`);
    };
    const dlsDestination = _ConnectionBlock.fromSFDestination(generator.generatorType, generator.generatorValue);
    if (dlsDestination === undefined) {
      failed("Invalid type");
      return;
    }
    const source = new ConnectionSource;
    let destination;
    let amount = generator.generatorValue;
    if (typeof dlsDestination === "number") {
      destination = dlsDestination;
    } else {
      destination = dlsDestination.destination;
      amount = dlsDestination.amount;
      source.source = dlsDestination.source;
      source.bipolar = dlsDestination.isBipolar;
    }
    articulation.connectionBlocks.push(new _ConnectionBlock(source, new ConnectionSource, destination, 0, amount << 16));
  }
  static fromSFDestination(dest, amount) {
    switch (dest) {
      default:
        return;
      case generatorTypes.initialAttenuation:
        return {
          destination: dlsDestinations.gain,
          amount: -amount,
          isBipolar: false,
          source: dlsSources.none
        };
      case generatorTypes.fineTune:
        return dlsDestinations.pitch;
      case generatorTypes.pan:
        return dlsDestinations.pan;
      case generatorTypes.keyNum:
        return dlsDestinations.keyNum;
      case generatorTypes.reverbEffectsSend:
        return dlsDestinations.reverbSend;
      case generatorTypes.chorusEffectsSend:
        return dlsDestinations.chorusSend;
      case generatorTypes.freqModLFO:
        return dlsDestinations.modLfoFreq;
      case generatorTypes.delayModLFO:
        return dlsDestinations.modLfoDelay;
      case generatorTypes.delayVibLFO:
        return dlsDestinations.vibLfoDelay;
      case generatorTypes.freqVibLFO:
        return dlsDestinations.vibLfoFreq;
      case generatorTypes.delayVolEnv:
        return dlsDestinations.volEnvDelay;
      case generatorTypes.attackVolEnv:
        return dlsDestinations.volEnvAttack;
      case generatorTypes.holdVolEnv:
        return dlsDestinations.volEnvHold;
      case generatorTypes.decayVolEnv:
        return dlsDestinations.volEnvDecay;
      case generatorTypes.sustainVolEnv:
        return {
          destination: dlsDestinations.volEnvSustain,
          amount: 1000 - amount,
          isBipolar: false,
          source: dlsSources.none
        };
      case generatorTypes.releaseVolEnv:
        return dlsDestinations.volEnvRelease;
      case generatorTypes.delayModEnv:
        return dlsDestinations.modEnvDelay;
      case generatorTypes.attackModEnv:
        return dlsDestinations.modEnvAttack;
      case generatorTypes.holdModEnv:
        return dlsDestinations.modEnvHold;
      case generatorTypes.decayModEnv:
        return dlsDestinations.modEnvDecay;
      case generatorTypes.sustainModEnv:
        return {
          destination: dlsDestinations.modEnvSustain,
          amount: 1000 - amount,
          isBipolar: false,
          source: dlsSources.none
        };
      case generatorTypes.releaseModEnv:
        return dlsDestinations.modEnvRelease;
      case generatorTypes.initialFilterFc:
        return dlsDestinations.filterCutoff;
      case generatorTypes.initialFilterQ:
        return dlsDestinations.filterQ;
      case generatorTypes.modEnvToFilterFc:
        return {
          source: dlsSources.modEnv,
          destination: dlsDestinations.filterCutoff,
          amount,
          isBipolar: false
        };
      case generatorTypes.modEnvToPitch:
        return {
          source: dlsSources.modEnv,
          destination: dlsDestinations.pitch,
          amount,
          isBipolar: false
        };
      case generatorTypes.modLfoToFilterFc:
        return {
          source: dlsSources.modLfo,
          destination: dlsDestinations.filterCutoff,
          amount,
          isBipolar: true
        };
      case generatorTypes.modLfoToVolume:
        return {
          source: dlsSources.modLfo,
          destination: dlsDestinations.gain,
          amount,
          isBipolar: true
        };
      case generatorTypes.modLfoToPitch:
        return {
          source: dlsSources.modLfo,
          destination: dlsDestinations.pitch,
          amount,
          isBipolar: true
        };
      case generatorTypes.vibLfoToPitch:
        return {
          source: dlsSources.vibratoLfo,
          destination: dlsDestinations.pitch,
          amount,
          isBipolar: true
        };
      case generatorTypes.keyNumToVolEnvHold:
        return {
          source: dlsSources.keyNum,
          destination: dlsDestinations.volEnvHold,
          amount,
          isBipolar: true
        };
      case generatorTypes.keyNumToVolEnvDecay:
        return {
          source: dlsSources.keyNum,
          destination: dlsDestinations.volEnvDecay,
          amount,
          isBipolar: true
        };
      case generatorTypes.keyNumToModEnvHold:
        return {
          source: dlsSources.keyNum,
          destination: dlsDestinations.modEnvHold,
          amount,
          isBipolar: true
        };
      case generatorTypes.keyNumToModEnvDecay:
        return {
          source: dlsSources.keyNum,
          destination: dlsDestinations.modEnvDecay,
          amount,
          isBipolar: true
        };
      case generatorTypes.scaleTuning:
        return {
          source: dlsSources.keyNum,
          destination: dlsDestinations.pitch,
          amount: amount * 128,
          isBipolar: false
        };
    }
  }
  toString() {
    return `Source: ${this.source.toString()},
Control: ${this.control.toString()},
Scale: ${this.scale} >> 16 = ${this.shortScale},
Output transform: ${this.transformName}
Destination: ${this.destinationName}`;
  }
  write() {
    const out = new IndexedByteArray(12);
    writeWord(out, this.source.source);
    writeWord(out, this.control.source);
    writeWord(out, this.destination);
    const transformEnum = this.transform | this.control.toTransformFlag() << 4 | this.source.toTransformFlag() << 10;
    writeWord(out, transformEnum);
    writeDword(out, this.scale);
    return out;
  }
  toSFGenerator(zone) {
    const destination = this.destination;
    const value = this.shortScale;
    switch (destination) {
      default:
        SpessaSynthInfo(`%cFailed converting DLS articulator into SF generator: %c${this.toString()}%c
(invalid destination)`, consoleColors.warn, consoleColors.value, consoleColors.unrecognized);
        return;
      case dlsDestinations.pan:
        zone.setGenerator(generatorTypes.pan, value);
        break;
      case dlsDestinations.gain:
        zone.addToGenerator(generatorTypes.initialAttenuation, -value / 0.4);
        break;
      case dlsDestinations.filterCutoff:
        zone.setGenerator(generatorTypes.initialFilterFc, value);
        break;
      case dlsDestinations.filterQ:
        zone.setGenerator(generatorTypes.initialFilterQ, value);
        break;
      case dlsDestinations.modLfoFreq:
        zone.setGenerator(generatorTypes.freqModLFO, value);
        break;
      case dlsDestinations.modLfoDelay:
        zone.setGenerator(generatorTypes.delayModLFO, value);
        break;
      case dlsDestinations.vibLfoFreq:
        zone.setGenerator(generatorTypes.freqVibLFO, value);
        break;
      case dlsDestinations.vibLfoDelay:
        zone.setGenerator(generatorTypes.delayVibLFO, value);
        break;
      case dlsDestinations.volEnvDelay:
        zone.setGenerator(generatorTypes.delayVolEnv, value);
        break;
      case dlsDestinations.volEnvAttack:
        zone.setGenerator(generatorTypes.attackVolEnv, value);
        break;
      case dlsDestinations.volEnvHold:
        zone.setGenerator(generatorTypes.holdVolEnv, value);
        break;
      case dlsDestinations.volEnvDecay:
        zone.setGenerator(generatorTypes.decayVolEnv, value);
        break;
      case dlsDestinations.volEnvRelease:
        zone.setGenerator(generatorTypes.releaseVolEnv, value);
        break;
      case dlsDestinations.volEnvSustain:
        zone.setGenerator(generatorTypes.sustainVolEnv, 1000 - value);
        break;
      case dlsDestinations.modEnvDelay:
        zone.setGenerator(generatorTypes.delayModEnv, value);
        break;
      case dlsDestinations.modEnvAttack:
        zone.setGenerator(generatorTypes.attackModEnv, value);
        break;
      case dlsDestinations.modEnvHold:
        zone.setGenerator(generatorTypes.holdModEnv, value);
        break;
      case dlsDestinations.modEnvDecay:
        zone.setGenerator(generatorTypes.decayModEnv, value);
        break;
      case dlsDestinations.modEnvRelease:
        zone.setGenerator(generatorTypes.releaseModEnv, value);
        break;
      case dlsDestinations.modEnvSustain:
        zone.setGenerator(generatorTypes.sustainModEnv, 1000 - value);
        break;
      case dlsDestinations.reverbSend:
        zone.setGenerator(generatorTypes.reverbEffectsSend, value);
        break;
      case dlsDestinations.chorusSend:
        zone.setGenerator(generatorTypes.chorusEffectsSend, value);
        break;
      case dlsDestinations.pitch:
        zone.fineTuning += value;
        break;
    }
  }
  toSFModulator(zone) {
    let amount = this.shortScale;
    let modulatorDestination;
    let primarySource;
    let secondarySource = new ModulatorSource;
    const failed = (msg) => {
      SpessaSynthInfo(`%cFailed converting DLS articulator into SF2:
 %c${this.toString()}%c
(${msg})`, consoleColors.warn, consoleColors.value, consoleColors.unrecognized);
    };
    const specialDestination = this.toCombinedSFDestination();
    if (specialDestination) {
      modulatorDestination = specialDestination;
      const controlSF = this.control.toSFSource();
      if (!controlSF) {
        failed("Invalid control");
        return;
      }
      primarySource = controlSF;
    } else {
      const convertedDestination = this.toSFDestination();
      if (!convertedDestination) {
        failed("Invalid destination");
        return;
      }
      if (typeof convertedDestination === "object") {
        amount = convertedDestination.newAmount;
        modulatorDestination = convertedDestination.gen;
      } else {
        modulatorDestination = convertedDestination;
      }
      const convertedPrimary = this.source.toSFSource();
      if (!convertedPrimary) {
        failed("Invalid source");
        return;
      }
      primarySource = convertedPrimary;
      const convertedSecondary = this.control.toSFSource();
      if (!convertedSecondary) {
        failed("Invalid control");
        return;
      }
      secondarySource = convertedSecondary;
    }
    if (this.transform !== modulatorCurveTypes.linear && primarySource.curveType === modulatorCurveTypes.linear) {
      primarySource.curveType = this.transform;
    }
    if (modulatorDestination === generatorTypes.initialAttenuation) {
      if (this.source.source === dlsSources.velocity || this.source.source === dlsSources.volume || this.source.source === dlsSources.expression) {
        primarySource.isNegative = true;
      }
      amount = Math.min(960, Math.max(0, amount));
    }
    const mod = new Modulator(primarySource, secondarySource, modulatorDestination, amount, 0);
    zone.addModulators(mod);
  }
  toCombinedSFDestination() {
    const source = this.source.source;
    const destination = this.destination;
    if (source === dlsSources.vibratoLfo && destination === dlsDestinations.pitch) {
      return generatorTypes.vibLfoToPitch;
    } else if (source === dlsSources.modLfo && destination === dlsDestinations.pitch) {
      return generatorTypes.modLfoToPitch;
    } else if (source === dlsSources.modLfo && destination === dlsDestinations.filterCutoff) {
      return generatorTypes.modLfoToFilterFc;
    } else if (source === dlsSources.modLfo && destination === dlsDestinations.gain) {
      return generatorTypes.modLfoToVolume;
    } else if (source === dlsSources.modEnv && destination === dlsDestinations.filterCutoff) {
      return generatorTypes.modEnvToFilterFc;
    } else if (source === dlsSources.modEnv && destination === dlsDestinations.pitch) {
      return generatorTypes.modEnvToPitch;
    } else {
      return;
    }
  }
  toSFDestination() {
    const amount = this.shortScale;
    switch (this.destination) {
      default:
      case dlsDestinations.none:
        return;
      case dlsDestinations.pan:
        return generatorTypes.pan;
      case dlsDestinations.gain:
        return {
          gen: generatorTypes.initialAttenuation,
          newAmount: -amount
        };
      case dlsDestinations.pitch:
        return generatorTypes.fineTune;
      case dlsDestinations.keyNum:
        return generatorTypes.overridingRootKey;
      case dlsDestinations.volEnvDelay:
        return generatorTypes.delayVolEnv;
      case dlsDestinations.volEnvAttack:
        return generatorTypes.attackVolEnv;
      case dlsDestinations.volEnvHold:
        return generatorTypes.holdVolEnv;
      case dlsDestinations.volEnvDecay:
        return generatorTypes.decayVolEnv;
      case dlsDestinations.volEnvSustain:
        return {
          gen: generatorTypes.sustainVolEnv,
          newAmount: 1000 - amount
        };
      case dlsDestinations.volEnvRelease:
        return generatorTypes.releaseVolEnv;
      case dlsDestinations.modEnvDelay:
        return generatorTypes.delayModEnv;
      case dlsDestinations.modEnvAttack:
        return generatorTypes.attackModEnv;
      case dlsDestinations.modEnvHold:
        return generatorTypes.holdModEnv;
      case dlsDestinations.modEnvDecay:
        return generatorTypes.decayModEnv;
      case dlsDestinations.modEnvSustain:
        return {
          gen: generatorTypes.sustainModEnv,
          newAmount: 1000 - amount
        };
      case dlsDestinations.modEnvRelease:
        return generatorTypes.releaseModEnv;
      case dlsDestinations.filterCutoff:
        return generatorTypes.initialFilterFc;
      case dlsDestinations.filterQ:
        return generatorTypes.initialFilterQ;
      case dlsDestinations.chorusSend:
        return generatorTypes.chorusEffectsSend;
      case dlsDestinations.reverbSend:
        return generatorTypes.reverbEffectsSend;
      case dlsDestinations.modLfoFreq:
        return generatorTypes.freqModLFO;
      case dlsDestinations.modLfoDelay:
        return generatorTypes.delayModLFO;
      case dlsDestinations.vibLfoFreq:
        return generatorTypes.freqVibLFO;
      case dlsDestinations.vibLfoDelay:
        return generatorTypes.delayVibLFO;
    }
  }
};
var DownloadableSoundsArticulation = class _DownloadableSoundsArticulation extends DLSVerifier {
  connectionBlocks = new Array;
  mode = "dls2";
  get length() {
    return this.connectionBlocks.length;
  }
  copyFrom(inputArticulation) {
    this.mode = inputArticulation.mode;
    inputArticulation.connectionBlocks.forEach((block) => {
      this.connectionBlocks.push(ConnectionBlock.copyFrom(block));
    });
  }
  fromSFZone(z) {
    this.mode = "dls2";
    const zone = new BasicZone;
    zone.copyFrom(z);
    for (const relativeGenerator of zone.generators) {
      let absoluteCounterpart = undefined;
      switch (relativeGenerator.generatorType) {
        default:
          continue;
        case generatorTypes.keyNumToVolEnvDecay:
          absoluteCounterpart = generatorTypes.decayVolEnv;
          break;
        case generatorTypes.keyNumToVolEnvHold:
          absoluteCounterpart = generatorTypes.holdVolEnv;
          break;
        case generatorTypes.keyNumToModEnvDecay:
          absoluteCounterpart = generatorTypes.decayModEnv;
          break;
        case generatorTypes.keyNumToModEnvHold:
          absoluteCounterpart = generatorTypes.holdModEnv;
      }
      const absoluteValue = zone.getGenerator(absoluteCounterpart, undefined);
      const dlsRelative = relativeGenerator.generatorValue * -128;
      if (absoluteValue === undefined) {
        continue;
      }
      const subtraction = 60 / 128 * dlsRelative;
      const newAbsolute = absoluteValue - subtraction;
      zone.setGenerator(relativeGenerator.generatorType, dlsRelative, false);
      zone.setGenerator(absoluteCounterpart, newAbsolute, false);
    }
    for (const generator of zone.generators) {
      ConnectionBlock.fromSFGenerator(generator, this);
    }
    for (const modulator of zone.modulators) {
      ConnectionBlock.fromSFModulator(modulator, this);
    }
  }
  read(chunks) {
    const lart = findRIFFListType(chunks, "lart");
    const lar2 = findRIFFListType(chunks, "lar2");
    if (lart) {
      this.mode = "dls1";
      while (lart.data.currentIndex < lart.data.length) {
        const art1 = readRIFFChunk(lart.data);
        _DownloadableSoundsArticulation.verifyHeader(art1, "art1", "art2");
        const artData = art1.data;
        const cbSize = readLittleEndianIndexed(artData, 4);
        if (cbSize !== 8) {
          SpessaSynthWarn(`CbSize in articulation mismatch. Expected 8, got ${cbSize}`);
        }
        const connectionsAmount = readLittleEndianIndexed(artData, 4);
        for (let i = 0;i < connectionsAmount; i++) {
          this.connectionBlocks.push(ConnectionBlock.read(artData));
        }
      }
    } else if (lar2) {
      this.mode = "dls2";
      while (lar2.data.currentIndex < lar2.data.length) {
        const art2 = readRIFFChunk(lar2.data);
        _DownloadableSoundsArticulation.verifyHeader(art2, "art2", "art1");
        const artData = art2.data;
        const cbSize = readLittleEndianIndexed(artData, 4);
        if (cbSize !== 8) {
          SpessaSynthWarn(`CbSize in articulation mismatch. Expected 8, got ${cbSize}`);
        }
        const connectionsAmount = readLittleEndianIndexed(artData, 4);
        for (let i = 0;i < connectionsAmount; i++) {
          this.connectionBlocks.push(ConnectionBlock.read(artData));
        }
      }
    }
  }
  write() {
    const art2Data = new IndexedByteArray(8);
    writeDword(art2Data, 8);
    writeDword(art2Data, this.connectionBlocks.length);
    const out = this.connectionBlocks.map((a) => a.write());
    const art2 = writeRIFFChunkParts(this.mode === "dls2" ? "art2" : "art1", [art2Data, ...out]);
    return writeRIFFChunkRaw(this.mode === "dls2" ? "lar2" : "lart", art2, false, true);
  }
  toSFZone(zone) {
    const applyKeyToCorrection = (value, keyToGen, realGen, dlsDestination) => {
      const keyToGenValue = value / -128;
      zone.setGenerator(keyToGen, keyToGenValue);
      if (keyToGenValue <= 120) {
        const correction = Math.round(60 / 128 * value);
        const realValueConnection = this.connectionBlocks.find((block) => block.isStaticParameter && block.destination === dlsDestination);
        if (realValueConnection) {
          zone.setGenerator(realGen, correction + realValueConnection.shortScale);
        }
      }
    };
    for (const connection of this.connectionBlocks) {
      const amount = connection.shortScale;
      const source = connection.source.source;
      const control = connection.control.source;
      const destination = connection.destination;
      if (connection.isStaticParameter) {
        connection.toSFGenerator(zone);
        continue;
      }
      if (control === dlsSources.none) {
        if (source === dlsSources.keyNum) {
          if (destination === dlsDestinations.pitch) {
            zone.setGenerator(generatorTypes.scaleTuning, amount / 128);
            continue;
          }
          if (destination === dlsDestinations.modEnvHold || destination === dlsDestinations.modEnvDecay || destination === dlsDestinations.volEnvHold || destination == dlsDestinations.volEnvDecay) {
            continue;
          }
        } else {
          const specialGen = connection.toCombinedSFDestination();
          if (specialGen) {
            zone.setGenerator(specialGen, amount);
            continue;
          }
        }
      }
      connection.toSFModulator(zone);
    }
    if (this.mode === "dls1") {
      zone.addModulators(Modulator.copyFrom(DLS_1_NO_VIBRATO_MOD), Modulator.copyFrom(DLS_1_NO_VIBRATO_PRESSURE));
    }
    for (const connection of this.connectionBlocks) {
      if (connection.source.source !== dlsSources.keyNum) {
        continue;
      }
      const generatorAmount = connection.shortScale;
      switch (connection.destination) {
        default:
          continue;
        case dlsDestinations.volEnvHold:
          applyKeyToCorrection(generatorAmount, generatorTypes.keyNumToVolEnvHold, generatorTypes.holdVolEnv, dlsDestinations.volEnvHold);
          break;
        case dlsDestinations.volEnvDecay:
          applyKeyToCorrection(generatorAmount, generatorTypes.keyNumToVolEnvDecay, generatorTypes.decayVolEnv, dlsDestinations.volEnvDecay);
          break;
        case dlsDestinations.modEnvHold:
          applyKeyToCorrection(generatorAmount, generatorTypes.keyNumToModEnvHold, generatorTypes.holdModEnv, dlsDestinations.modEnvHold);
          break;
        case dlsDestinations.modEnvDecay:
          applyKeyToCorrection(generatorAmount, generatorTypes.keyNumToModEnvDecay, generatorTypes.decayModEnv, dlsDestinations.modEnvDecay);
          break;
      }
    }
  }
};
var WaveLink = class _WaveLink {
  channel = 1;
  tableIndex;
  fusOptions = 0;
  phaseGroup = 0;
  constructor(tableIndex) {
    this.tableIndex = tableIndex;
  }
  static copyFrom(waveLink) {
    const wlnk = new _WaveLink(waveLink.tableIndex);
    wlnk.channel = waveLink.channel;
    wlnk.phaseGroup = waveLink.phaseGroup;
    wlnk.fusOptions = waveLink.fusOptions;
    return wlnk;
  }
  static read(chunk) {
    const fusOptions = readLittleEndianIndexed(chunk.data, 2);
    const phaseGroup = readLittleEndianIndexed(chunk.data, 2);
    const ulChannel = readLittleEndianIndexed(chunk.data, 4);
    const ulTableIndex = readLittleEndianIndexed(chunk.data, 4);
    const wlnk = new _WaveLink(ulTableIndex);
    wlnk.channel = ulChannel;
    wlnk.fusOptions = fusOptions;
    wlnk.phaseGroup = phaseGroup;
    return wlnk;
  }
  static fromSFZone(samples, zone) {
    const index = samples.indexOf(zone.sample);
    if (index < 0) {
      throw new Error(`Wave link error: Sample ${zone.sample.name} does not exist in the sample list.`);
    }
    const waveLink = new _WaveLink(index);
    switch (zone.sample.sampleType) {
      default:
      case sampleTypes.leftSample:
      case sampleTypes.monoSample:
        waveLink.channel = 1 << 0;
        break;
      case sampleTypes.rightSample:
        waveLink.channel = 1 << 1;
    }
    return waveLink;
  }
  write() {
    const wlnkData = new IndexedByteArray(12);
    writeWord(wlnkData, this.fusOptions);
    writeWord(wlnkData, this.phaseGroup);
    writeDword(wlnkData, this.channel);
    writeDword(wlnkData, this.tableIndex);
    return writeRIFFChunkRaw("wlnk", wlnkData);
  }
};
var DownloadableSoundsRegion = class _DownloadableSoundsRegion extends DLSVerifier {
  articulation = new DownloadableSoundsArticulation;
  keyRange = {
    min: 0,
    max: 127
  };
  velRange = {
    min: 0,
    max: 127
  };
  keyGroup = 0;
  fusOptions = 0;
  usLayer = 0;
  waveSample;
  waveLink;
  constructor(waveLink, waveSample) {
    super();
    this.waveSample = waveSample;
    this.waveLink = waveLink;
  }
  static copyFrom(inputRegion) {
    const outputRegion = new _DownloadableSoundsRegion(WaveLink.copyFrom(inputRegion.waveLink), WaveSample.copyFrom(inputRegion.waveSample));
    outputRegion.keyGroup = inputRegion.keyGroup;
    outputRegion.keyRange = { ...inputRegion.keyRange };
    outputRegion.velRange = { ...inputRegion.velRange };
    outputRegion.usLayer = inputRegion.usLayer;
    outputRegion.fusOptions = inputRegion.fusOptions;
    outputRegion.articulation.copyFrom(inputRegion.articulation);
    return outputRegion;
  }
  static read(samples, chunk) {
    const regionChunks = this.verifyAndReadList(chunk, "rgn ", "rgn2");
    const waveSampleChunk = regionChunks.find((c) => c.header === "wsmp");
    let waveSample = waveSampleChunk ? WaveSample.read(waveSampleChunk) : undefined;
    const waveLinkChunk = regionChunks.find((c) => c.header === "wlnk");
    if (!waveLinkChunk) {
      SpessaSynthWarn("Invalid DLS region: missing 'wlnk' chunk! Discarding...");
      return;
    }
    const waveLink = WaveLink.read(waveLinkChunk);
    const regionHeader = regionChunks.find((c) => c.header === "rgnh");
    if (!regionHeader) {
      SpessaSynthWarn("Invalid DLS region: missing 'rgnh' chunk! Discarding...");
      return;
    }
    const sample = samples[waveLink.tableIndex];
    if (!sample) {
      _DownloadableSoundsRegion.parsingError(`Invalid sample index: ${waveLink.tableIndex}. Samples available: ${samples.length}`);
    }
    waveSample ??= sample.waveSample;
    const region = new _DownloadableSoundsRegion(waveLink, waveSample);
    const keyMin = readLittleEndianIndexed(regionHeader.data, 2);
    const keyMax = readLittleEndianIndexed(regionHeader.data, 2);
    let velMin = readLittleEndianIndexed(regionHeader.data, 2);
    let velMax = readLittleEndianIndexed(regionHeader.data, 2);
    if (velMin === 0 && velMax === 0) {
      velMax = 127;
      velMin = 0;
    }
    region.keyRange.max = keyMax;
    region.keyRange.min = keyMin;
    region.velRange.max = velMax;
    region.velRange.min = velMin;
    region.fusOptions = readLittleEndianIndexed(regionHeader.data, 2);
    region.keyGroup = readLittleEndianIndexed(regionHeader.data, 2);
    if (regionHeader.data.length - regionHeader.data.currentIndex >= 2) {
      region.usLayer = readLittleEndianIndexed(regionHeader.data, 2);
    }
    region.articulation.read(regionChunks);
    return region;
  }
  static fromSFZone(zone, samples) {
    const waveSample = WaveSample.fromSFZone(zone);
    const waveLink = WaveLink.fromSFZone(samples, zone);
    const region = new _DownloadableSoundsRegion(waveLink, waveSample);
    region.keyRange.min = Math.max(zone.keyRange.min, 0);
    region.keyRange.max = zone.keyRange.max;
    region.velRange.min = Math.max(zone.velRange.min, 0);
    region.velRange.max = zone.velRange.max;
    region.keyGroup = zone.getGenerator(generatorTypes.exclusiveClass, 0);
    region.articulation.fromSFZone(zone);
    return region;
  }
  write() {
    const chunks = [
      this.writeHeader(),
      this.waveSample.write(),
      this.waveLink.write(),
      this.articulation.write()
    ];
    return writeRIFFChunkParts("rgn2", chunks, true);
  }
  toSFZone(instrument, samples) {
    const sample = samples[this.waveLink.tableIndex];
    if (!sample) {
      _DownloadableSoundsRegion.parsingError(`Invalid sample index: ${this.waveLink.tableIndex}`);
    }
    const zone = instrument.createZone(sample);
    zone.keyRange = this.keyRange;
    zone.velRange = this.velRange;
    if (this.keyRange.max === 127 && this.keyRange.min === 0) {
      zone.keyRange.min = -1;
    }
    if (this.velRange.max === 127 && this.velRange.min === 0) {
      zone.velRange.min = -1;
    }
    if (this.keyGroup !== 0) {
      zone.setGenerator(generatorTypes.exclusiveClass, this.keyGroup);
    }
    this.waveSample.toSFZone(zone, sample);
    this.articulation.toSFZone(zone);
    zone.generators = zone.generators.filter((g) => g.generatorValue !== generatorLimits[g.generatorType].def);
    return zone;
  }
  writeHeader() {
    const rgnhData = new IndexedByteArray(12);
    writeWord(rgnhData, Math.max(this.keyRange.min, 0));
    writeWord(rgnhData, this.keyRange.max);
    writeWord(rgnhData, Math.max(this.velRange.min, 0));
    writeWord(rgnhData, this.velRange.max);
    writeWord(rgnhData, this.fusOptions);
    writeWord(rgnhData, this.keyGroup);
    writeWord(rgnhData, this.usLayer);
    return writeRIFFChunkRaw("rgnh", rgnhData);
  }
};
var DownloadableSoundsInstrument = class _DownloadableSoundsInstrument extends DLSVerifier {
  articulation = new DownloadableSoundsArticulation;
  regions = new Array;
  name = "Unnamed";
  bankLSB = 0;
  bankMSB = 0;
  isGMGSDrum = false;
  program = 0;
  static copyFrom(inputInstrument) {
    const outputInstrument = new _DownloadableSoundsInstrument;
    outputInstrument.name = inputInstrument.name;
    outputInstrument.isGMGSDrum = inputInstrument.isGMGSDrum;
    outputInstrument.bankMSB = inputInstrument.bankMSB;
    outputInstrument.bankLSB = inputInstrument.bankLSB;
    outputInstrument.program = inputInstrument.program;
    outputInstrument.articulation.copyFrom(inputInstrument.articulation);
    inputInstrument.regions.forEach((region) => {
      outputInstrument.regions.push(DownloadableSoundsRegion.copyFrom(region));
    });
    return outputInstrument;
  }
  static read(samples, chunk) {
    const chunks = this.verifyAndReadList(chunk, "ins ");
    const instrumentHeader = chunks.find((c) => c.header === "insh");
    if (!instrumentHeader) {
      SpessaSynthGroupEnd();
      throw new Error("No instrument header!");
    }
    let instrumentName = ``;
    const infoChunk = findRIFFListType(chunks, "INFO");
    if (infoChunk) {
      let info = readRIFFChunk(infoChunk.data);
      while (info.header !== "INAM") {
        info = readRIFFChunk(infoChunk.data);
      }
      instrumentName = readBinaryStringIndexed(info.data, info.data.length).trim();
    }
    if (instrumentName.length < 1) {
      instrumentName = `Unnamed Instrument`;
    }
    const instrument = new _DownloadableSoundsInstrument;
    instrument.name = instrumentName;
    const regions = readLittleEndianIndexed(instrumentHeader.data, 4);
    const ulBank = readLittleEndianIndexed(instrumentHeader.data, 4);
    const ulInstrument = readLittleEndianIndexed(instrumentHeader.data, 4);
    instrument.program = ulInstrument & 127;
    instrument.bankMSB = ulBank >>> 8 & 127;
    instrument.bankLSB = ulBank & 127;
    instrument.isGMGSDrum = ulBank >>> 31 > 0;
    SpessaSynthGroupCollapsed(`%cParsing %c"${instrumentName}"%c...`, consoleColors.info, consoleColors.recognized, consoleColors.info);
    const regionListChunk = findRIFFListType(chunks, "lrgn");
    if (!regionListChunk) {
      SpessaSynthGroupEnd();
      throw new Error("No region list!");
    }
    instrument.articulation.read(chunks);
    for (let i = 0;i < regions; i++) {
      const chunk2 = readRIFFChunk(regionListChunk.data);
      this.verifyHeader(chunk2, "LIST");
      const type = readBinaryStringIndexed(chunk2.data, 4);
      if (type !== "rgn " && type !== "rgn2") {
        SpessaSynthGroupEnd();
        this.parsingError(`Invalid DLS region! Expected "rgn " or "rgn2" got "${type}"`);
      }
      const region = DownloadableSoundsRegion.read(samples, chunk2);
      if (region) {
        instrument.regions.push(region);
      }
    }
    SpessaSynthGroupEnd();
    return instrument;
  }
  static fromSFPreset(preset, samples) {
    const instrument = new _DownloadableSoundsInstrument;
    instrument.name = preset.name;
    instrument.bankLSB = preset.bankLSB;
    instrument.bankMSB = preset.bankMSB;
    instrument.program = preset.program;
    instrument.isGMGSDrum = preset.isGMGSDrum;
    SpessaSynthGroup(`%cConverting %c${preset.toString()}%c to DLS...`, consoleColors.info, consoleColors.value, consoleColors.info);
    const inst = preset.toFlattenedInstrument();
    inst.zones.forEach((z) => {
      instrument.regions.push(DownloadableSoundsRegion.fromSFZone(z, samples));
    });
    SpessaSynthGroupEnd();
    return instrument;
  }
  write() {
    SpessaSynthGroupCollapsed(`%cWriting %c${this.name}%c...`, consoleColors.info, consoleColors.recognized, consoleColors.info);
    const chunks = [this.writeHeader()];
    const regionChunks = this.regions.map((r) => r.write());
    chunks.push(writeRIFFChunkParts("lrgn", regionChunks, true));
    if (this.articulation.length > 0) {
      chunks.push(this.articulation.write());
    }
    const inam = writeRIFFChunkRaw("INAM", getStringBytes(this.name, true));
    chunks.push(writeRIFFChunkRaw("INFO", inam, false, true));
    SpessaSynthGroupEnd();
    return writeRIFFChunkParts("ins ", chunks, true);
  }
  toSFPreset(soundBank) {
    const preset = new BasicPreset(soundBank);
    preset.name = this.name;
    preset.bankMSB = this.bankMSB;
    preset.bankLSB = this.bankLSB;
    preset.isGMGSDrum = this.isGMGSDrum;
    preset.program = this.program;
    const instrument = new BasicInstrument;
    instrument.name = this.name;
    preset.createZone(instrument);
    this.articulation.toSFZone(instrument.globalZone);
    this.regions.forEach((region) => region.toSFZone(instrument, soundBank.samples));
    instrument.globalize();
    if (instrument.globalZone.modulators.find((m) => m.destination === generatorTypes.reverbEffectsSend) === undefined) {
      instrument.globalZone.addModulators(Modulator.copyFrom(DEFAULT_DLS_REVERB));
    }
    if (instrument.globalZone.modulators.find((m) => m.destination === generatorTypes.chorusEffectsSend) === undefined) {
      instrument.globalZone.addModulators(Modulator.copyFrom(DEFAULT_DLS_CHORUS));
    }
    instrument.globalZone.generators = instrument.globalZone.generators.filter((g) => g.generatorValue !== generatorLimits[g.generatorType].def);
    soundBank.addPresets(preset);
    soundBank.addInstruments(instrument);
  }
  writeHeader() {
    const inshData = new IndexedByteArray(12);
    writeDword(inshData, this.regions.length);
    let ulBank = (this.bankMSB & 127) << 8 | this.bankLSB & 127;
    if (this.isGMGSDrum) {
      ulBank |= 1 << 31;
    }
    writeDword(inshData, ulBank);
    writeDword(inshData, this.program & 127);
    return writeRIFFChunkRaw("insh", inshData);
  }
};
var DEFAULT_DLS_OPTIONS = {
  progressFunction: undefined
};
var DownloadableSounds = class _DownloadableSounds extends DLSVerifier {
  samples = new Array;
  instruments = new Array;
  soundBankInfo = {
    name: "Unnamed",
    creationDate: /* @__PURE__ */ new Date,
    software: "SpessaSynth",
    soundEngine: "DLS Level 2.2",
    version: {
      major: 2,
      minor: 4
    }
  };
  static read(buffer) {
    if (!buffer) {
      throw new Error("No data provided!");
    }
    const dataArray = new IndexedByteArray(buffer);
    SpessaSynthGroup("%cParsing DLS file...", consoleColors.info);
    const firstChunk = readRIFFChunk(dataArray, false);
    this.verifyHeader(firstChunk, "RIFF");
    this.verifyText(readBinaryStringIndexed(dataArray, 4).toLowerCase(), "dls ");
    const chunks = [];
    while (dataArray.currentIndex < dataArray.length) {
      chunks.push(readRIFFChunk(dataArray));
    }
    const dls = new _DownloadableSounds;
    dls.soundBankInfo.name = "Unnamed DLS";
    dls.soundBankInfo.product = "SpessaSynth DLS";
    dls.soundBankInfo.comment = "(no description)";
    const infoChunk = findRIFFListType(chunks, "INFO");
    if (infoChunk) {
      while (infoChunk.data.currentIndex < infoChunk.data.length) {
        const infoPart = readRIFFChunk(infoChunk.data);
        const headerTyped = infoPart.header;
        const text = readBinaryStringIndexed(infoPart.data, infoPart.size);
        switch (headerTyped) {
          case "INAM":
            dls.soundBankInfo.name = text;
            break;
          case "ICRD":
            dls.soundBankInfo.creationDate = parseDateString(text);
            break;
          case "ICMT":
            dls.soundBankInfo.comment = text;
            break;
          case "ISBJ":
            dls.soundBankInfo.subject = text;
            break;
          case "ICOP":
            dls.soundBankInfo.copyright = text;
            break;
          case "IENG":
            dls.soundBankInfo.engineer = text;
            break;
          case "IPRD":
            dls.soundBankInfo.product = text;
            break;
          case "ISFT":
            dls.soundBankInfo.software = text;
        }
      }
    }
    this.printInfo(dls);
    const colhChunk = chunks.find((c) => c.header === "colh");
    if (!colhChunk) {
      this.parsingError("No colh chunk!");
      return 5;
    }
    const instrumentAmount = readLittleEndianIndexed(colhChunk.data, 4);
    SpessaSynthInfo(`%cInstruments amount: %c${instrumentAmount}`, consoleColors.info, consoleColors.recognized);
    const waveListChunk = findRIFFListType(chunks, "wvpl");
    if (!waveListChunk) {
      this.parsingError("No wvpl chunk!");
      return 5;
    }
    const waveList = this.verifyAndReadList(waveListChunk, "wvpl");
    waveList.forEach((wave) => {
      dls.samples.push(DownloadableSoundsSample.read(wave));
    });
    const instrumentListChunk = findRIFFListType(chunks, "lins");
    if (!instrumentListChunk) {
      this.parsingError("No lins chunk!");
      return 5;
    }
    const instruments = this.verifyAndReadList(instrumentListChunk, "lins");
    SpessaSynthGroupCollapsed("%cLoading instruments...", consoleColors.info);
    if (instruments.length !== instrumentAmount) {
      SpessaSynthWarn(`Colh reported invalid amount of instruments. Detected ${instruments.length}, expected ${instrumentAmount}`);
    }
    instruments.forEach((ins) => {
      dls.instruments.push(DownloadableSoundsInstrument.read(dls.samples, ins));
    });
    SpessaSynthGroupEnd();
    const aliasingChunk = chunks.find((c) => c.header === "pgal");
    if (aliasingChunk) {
      SpessaSynthInfo("%cFound the instrument aliasing chunk!", consoleColors.recognized);
      const pgalData = aliasingChunk.data;
      if (pgalData[0] !== 0 || pgalData[1] !== 1 || pgalData[2] !== 2 || pgalData[3] !== 3) {
        pgalData.currentIndex += 4;
      }
      const drumInstrument = dls.instruments.find((i) => BankSelectHacks.isXGDrums(i.bankMSB) || i.isGMGSDrum);
      if (!drumInstrument) {
        SpessaSynthWarn("MobileBAE aliasing chunk without a drum preset. Aborting!");
        return dls;
      }
      const drumAliases = pgalData.slice(pgalData.currentIndex, pgalData.currentIndex + 128);
      pgalData.currentIndex += 128;
      for (let keyNum = 0;keyNum < 128; keyNum++) {
        const alias = drumAliases[keyNum];
        if (alias === keyNum) {
          continue;
        }
        const region = drumInstrument.regions.find((r) => r.keyRange.max === alias && r.keyRange.min === alias);
        if (!region) {
          SpessaSynthWarn(`Invalid drum alias ${keyNum} to ${alias}: region does not exist.`);
          continue;
        }
        const copied = DownloadableSoundsRegion.copyFrom(region);
        copied.keyRange.max = keyNum;
        copied.keyRange.min = keyNum;
        drumInstrument.regions.push(copied);
      }
      pgalData.currentIndex += 4;
      while (pgalData.currentIndex < pgalData.length) {
        const aliasBankNum = readLittleEndianIndexed(pgalData, 2);
        const aliasBankLSB = aliasBankNum & 127;
        const aliasBankMSB = aliasBankNum >> 7 & 127;
        const aliasProgram = pgalData[pgalData.currentIndex++];
        let nullByte = pgalData[pgalData.currentIndex++];
        if (nullByte !== 0) {
          SpessaSynthWarn(`Invalid alias byte. Expected 0, got ${nullByte}`);
        }
        const inputBankNum = readLittleEndianIndexed(pgalData, 2);
        const inputBankLSB = inputBankNum & 127;
        const inputBankMSB = inputBankNum >> 7 & 127;
        const inputProgram = pgalData[pgalData.currentIndex++];
        nullByte = pgalData[pgalData.currentIndex++];
        if (nullByte !== 0) {
          SpessaSynthWarn(`Invalid alias header. Expected 0, got ${nullByte}`);
        }
        const inputInstrument = dls.instruments.find((inst) => inst.bankLSB === inputBankLSB && inst.bankMSB === inputBankMSB && inst.program === inputProgram && !inst.isGMGSDrum);
        if (!inputInstrument) {
          SpessaSynthWarn(`Invalid alias. Missing instrument: ${inputBankLSB}:${inputBankMSB}:${inputProgram}`);
          continue;
        }
        const alias = DownloadableSoundsInstrument.copyFrom(inputInstrument);
        alias.bankMSB = aliasBankMSB;
        alias.bankLSB = aliasBankLSB;
        alias.program = aliasProgram;
        dls.instruments.push(alias);
      }
    }
    SpessaSynthInfo(`%cParsing finished! %c"${dls.soundBankInfo.name || "UNNAMED"}"%c has %c${dls.instruments.length}%c instruments and %c${dls.samples.length}%c samples.`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info);
    SpessaSynthGroupEnd();
    return dls;
  }
  static fromSF(bank) {
    SpessaSynthGroupCollapsed("%cSaving SF2 to DLS level 2...", consoleColors.info);
    const dls = new _DownloadableSounds;
    dls.soundBankInfo = { ...bank.soundBankInfo };
    dls.soundBankInfo.comment = (dls.soundBankInfo.comment ?? "(No description)") + `
Converted from SF2 to DLS with SpessaSynth`;
    bank.samples.forEach((s) => {
      dls.samples.push(DownloadableSoundsSample.fromSFSample(s));
    });
    bank.presets.forEach((p) => {
      dls.instruments.push(DownloadableSoundsInstrument.fromSFPreset(p, bank.samples));
    });
    SpessaSynthInfo("%cConversion complete!", consoleColors.recognized);
    SpessaSynthGroupEnd();
    return dls;
  }
  static printInfo(dls) {
    for (const [info, value] of Object.entries(dls.soundBankInfo)) {
      if (typeof value === "object" && "major" in value) {
        const v = value;
        SpessaSynthInfo(`%c${info}: %c"${v.major}.${v.minor}"`, consoleColors.info, consoleColors.recognized);
      }
      SpessaSynthInfo(`%c${info}: %c${value.toLocaleString()}`, consoleColors.info, consoleColors.recognized);
    }
  }
  async write(options = DEFAULT_DLS_OPTIONS) {
    SpessaSynthGroupCollapsed("%cSaving DLS...", consoleColors.info);
    const colhNum = new IndexedByteArray(4);
    writeDword(colhNum, this.instruments.length);
    const colh = writeRIFFChunkRaw("colh", colhNum);
    SpessaSynthGroupCollapsed("%cWriting instruments...", consoleColors.info);
    const lins = writeRIFFChunkParts("lins", this.instruments.map((i) => i.write()), true);
    SpessaSynthInfo("%cSuccess!", consoleColors.recognized);
    SpessaSynthGroupEnd();
    SpessaSynthGroupCollapsed("%cWriting WAVE samples...", consoleColors.info);
    let currentIndex = 0;
    const ptblOffsets = [];
    const samples = [];
    let written = 0;
    for (const s of this.samples) {
      const out2 = s.write();
      await options?.progressFunction?.(s.name, written, this.samples.length);
      ptblOffsets.push(currentIndex);
      currentIndex += out2.length;
      samples.push(out2);
      written++;
    }
    const wvpl = writeRIFFChunkParts("wvpl", samples, true);
    SpessaSynthInfo("%cSucceeded!", consoleColors.recognized);
    const ptblData = new IndexedByteArray(8 + 4 * ptblOffsets.length);
    writeDword(ptblData, 8);
    writeDword(ptblData, ptblOffsets.length);
    for (const offset of ptblOffsets) {
      writeDword(ptblData, offset);
    }
    const ptbl = writeRIFFChunkRaw("ptbl", ptblData);
    this.soundBankInfo.software = "SpessaSynth";
    const infos = [];
    const writeDLSInfo = (type, data) => {
      infos.push(writeRIFFChunkRaw(type, getStringBytes(data, true)));
    };
    for (const [t, d] of Object.entries(this.soundBankInfo)) {
      const type = t;
      const data = d;
      if (!data) {
        continue;
      }
      switch (type) {
        case "name":
          writeDLSInfo("INAM", data);
          break;
        case "comment":
          writeDLSInfo("ICMT", data);
          break;
        case "copyright":
          writeDLSInfo("ICOP", data);
          break;
        case "creationDate":
          writeDLSInfo("ICRD", data.toISOString());
          break;
        case "engineer":
          writeDLSInfo("IENG", data);
          break;
        case "product":
          writeDLSInfo("IPRD", data);
          break;
        case "romVersion":
        case "version":
        case "soundEngine":
        case "romInfo":
          break;
        case "software":
          writeDLSInfo("ISFT", data);
          break;
        case "subject":
          writeDLSInfo("ISBJ", data);
      }
    }
    const info = writeRIFFChunkParts("INFO", infos, true);
    SpessaSynthInfo("%cCombining everything...");
    const out = writeRIFFChunkParts("RIFF", [
      getStringBytes("DLS "),
      colh,
      lins,
      ptbl,
      wvpl,
      info
    ]);
    SpessaSynthInfo("%cSaved successfully!", consoleColors.recognized);
    SpessaSynthGroupEnd();
    return out.buffer;
  }
  toSF() {
    SpessaSynthGroup("%cConverting DLS to SF2...", consoleColors.info);
    const soundBank = new BasicSoundBank;
    soundBank.soundBankInfo.version.minor = 4;
    soundBank.soundBankInfo.version.major = 2;
    soundBank.soundBankInfo = { ...this.soundBankInfo };
    soundBank.soundBankInfo.comment = (soundBank.soundBankInfo.comment ?? "(No description)") + `
Converted from DLS to SF2 with SpessaSynth`;
    this.samples.forEach((sample) => {
      sample.toSFSample(soundBank);
    });
    this.instruments.forEach((instrument) => {
      instrument.toSFPreset(soundBank);
    });
    soundBank.flush();
    SpessaSynthInfo("%cConversion complete!", consoleColors.recognized);
    SpessaSynthGroupEnd();
    return soundBank;
  }
};
var BasicSoundBank = class _BasicSoundBank {
  static isSF3DecoderReady = stb.isInitialized;
  soundBankInfo = {
    name: "Unnamed",
    creationDate: /* @__PURE__ */ new Date,
    software: "SpessaSynth",
    soundEngine: "E-mu 10K2",
    version: {
      major: 2,
      minor: 4
    }
  };
  presets = [];
  samples = [];
  instruments = [];
  defaultModulators = SPESSASYNTH_DEFAULT_MODULATORS.map(Modulator.copyFrom.bind(Modulator));
  customDefaultModulators = false;
  _isXGBank = false;
  get isXGBank() {
    return this._isXGBank;
  }
  static mergeSoundBanks(...soundBanks) {
    const mainSf = soundBanks.shift();
    if (!mainSf) {
      throw new Error("No sound banks provided!");
    }
    const presets = mainSf.presets;
    while (soundBanks.length) {
      const newPresets = soundBanks?.shift()?.presets;
      if (newPresets) {
        newPresets.forEach((newPreset) => {
          if (presets.find((existingPreset) => newPreset.matches(existingPreset)) === undefined) {
            presets.push(newPreset);
          }
        });
      }
    }
    const b = new _BasicSoundBank;
    b.addCompletePresets(presets);
    b.soundBankInfo = { ...mainSf.soundBankInfo };
    return b;
  }
  static async getSampleSoundBankFile() {
    const font = new _BasicSoundBank;
    const sampleData = new Float32Array(128);
    for (let i = 0;i < 128; i++) {
      sampleData[i] = i / 128 * 2 - 1;
    }
    const sample = new EmptySample;
    sample.name = "Saw";
    sample.originalKey = 65;
    sample.pitchCorrection = 20;
    sample.loopEnd = 127;
    sample.setAudioData(sampleData, 44100);
    font.addSamples(sample);
    const inst = new BasicInstrument;
    inst.name = "Saw Wave";
    inst.globalZone.addGenerators(new Generator(generatorTypes.initialAttenuation, 375), new Generator(generatorTypes.releaseVolEnv, -1000), new Generator(generatorTypes.sampleModes, 1));
    inst.createZone(sample);
    const zone2 = inst.createZone(sample);
    zone2.addGenerators(new Generator(generatorTypes.fineTune, -9));
    font.addInstruments(inst);
    const preset = new BasicPreset(font);
    preset.name = "Saw Wave";
    preset.createZone(inst);
    font.addPresets(preset);
    font.soundBankInfo.name = "Dummy";
    font.flush();
    return await font.writeSF2();
  }
  static copyFrom(bank) {
    const copied = new _BasicSoundBank;
    bank.presets.forEach((p) => copied.clonePreset(p));
    copied.soundBankInfo = { ...bank.soundBankInfo };
    return copied;
  }
  addCompletePresets(presets) {
    this.addPresets(...presets);
    const instrumentList = [];
    for (const preset of presets) {
      for (const zone of preset.zones) {
        if (zone.instrument && !instrumentList.includes(zone.instrument)) {
          instrumentList.push(zone.instrument);
        }
      }
    }
    this.addInstruments(...instrumentList);
    const sampleList = [];
    for (const instrument of instrumentList) {
      for (const zone of instrument.zones) {
        if (zone.sample && !sampleList.includes(zone.sample)) {
          sampleList.push(zone.sample);
        }
      }
    }
    this.addSamples(...sampleList);
  }
  async writeDLS(options = DEFAULT_DLS_OPTIONS) {
    const dls = DownloadableSounds.fromSF(this);
    return dls.write(options);
  }
  async writeSF2(writeOptions = DEFAULT_SF2_WRITE_OPTIONS) {
    return writeSF2Internal(this, writeOptions);
  }
  addPresets(...presets) {
    this.presets.push(...presets);
  }
  addInstruments(...instruments) {
    this.instruments.push(...instruments);
  }
  addSamples(...samples) {
    this.samples.push(...samples);
  }
  cloneSample(sample) {
    const duplicate = this.samples.find((s) => s.name === sample.name);
    if (duplicate) {
      return duplicate;
    }
    const newSample = new BasicSample(sample.name, sample.sampleRate, sample.originalKey, sample.pitchCorrection, sample.sampleType, sample.loopStart, sample.loopEnd);
    if (sample.isCompressed) {
      newSample.setCompressedData(sample.getRawData(true));
    } else {
      newSample.setAudioData(sample.getAudioData(), sample.sampleRate);
    }
    this.addSamples(newSample);
    if (sample.linkedSample) {
      const clonedLinked = this.cloneSample(sample.linkedSample);
      if (!clonedLinked.linkedSample) {
        newSample.setLinkedSample(clonedLinked, newSample.sampleType);
      }
    }
    return newSample;
  }
  cloneInstrument(instrument) {
    const duplicate = this.instruments.find((i) => i.name === instrument.name);
    if (duplicate) {
      return duplicate;
    }
    const newInstrument = new BasicInstrument;
    newInstrument.name = instrument.name;
    newInstrument.globalZone.copyFrom(instrument.globalZone);
    for (const zone of instrument.zones) {
      const copiedZone = newInstrument.createZone(this.cloneSample(zone.sample));
      copiedZone.copyFrom(zone);
    }
    this.addInstruments(newInstrument);
    return newInstrument;
  }
  clonePreset(preset) {
    const duplicate = this.presets.find((p) => p.name === preset.name);
    if (duplicate) {
      return duplicate;
    }
    const newPreset = new BasicPreset(this);
    newPreset.name = preset.name;
    newPreset.bankMSB = preset.bankMSB;
    newPreset.bankLSB = preset.bankLSB;
    newPreset.isGMGSDrum = preset.isGMGSDrum;
    newPreset.program = preset.program;
    newPreset.library = preset.library;
    newPreset.genre = preset.genre;
    newPreset.morphology = preset.morphology;
    newPreset.globalZone.copyFrom(preset.globalZone);
    for (const zone of preset.zones) {
      const copiedZone = newPreset.createZone(this.cloneInstrument(zone.instrument));
      copiedZone.copyFrom(zone);
    }
    this.addPresets(newPreset);
    return newPreset;
  }
  flush() {
    this.presets.sort(MIDIPatchTools.sorter.bind(MIDIPatchTools));
    this.parseInternal();
  }
  trimSoundBank(mid) {
    const trimInstrumentZones = (instrument, combos) => {
      let trimmedIZones = 0;
      for (let iZoneIndex = 0;iZoneIndex < instrument.zones.length; iZoneIndex++) {
        const iZone = instrument.zones[iZoneIndex];
        const iKeyRange = iZone.keyRange;
        const iVelRange = iZone.velRange;
        let isIZoneUsed = false;
        for (const iCombo of combos) {
          if (iCombo.key >= iKeyRange.min && iCombo.key <= iKeyRange.max && iCombo.velocity >= iVelRange.min && iCombo.velocity <= iVelRange.max) {
            isIZoneUsed = true;
            break;
          }
        }
        if (!isIZoneUsed && iZone.sample) {
          SpessaSynthInfo(`%c${iZone.sample.name}%c removed from %c${instrument.name}%c.`, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info);
          if (instrument.deleteZone(iZoneIndex)) {
            trimmedIZones++;
            iZoneIndex--;
            SpessaSynthInfo(`%c${iZone.sample.name}%c deleted`, consoleColors.recognized, consoleColors.info);
          }
          if (iZone.sample.useCount < 1) {
            this.deleteSample(iZone.sample);
          }
        }
      }
      return trimmedIZones;
    };
    SpessaSynthGroup("%cTrimming sound bank...", consoleColors.info);
    const usedProgramsAndKeys = mid.getUsedProgramsAndKeys(this);
    SpessaSynthGroupCollapsed("%cModifying sound bank...", consoleColors.info);
    SpessaSynthInfo("Detected keys for midi:", usedProgramsAndKeys);
    for (let presetIndex = 0;presetIndex < this.presets.length; presetIndex++) {
      const p = this.presets[presetIndex];
      const used = usedProgramsAndKeys.get(p);
      if (used === undefined) {
        SpessaSynthInfo(`%cDeleting preset %c${p.name}%c and its zones`, consoleColors.info, consoleColors.recognized, consoleColors.info);
        this.deletePreset(p);
        presetIndex--;
      } else {
        const combos = [...used].map((s) => {
          const split = s.split("-");
          return {
            key: parseInt(split[0]),
            velocity: parseInt(split[1])
          };
        });
        SpessaSynthGroupCollapsed(`%cTrimming %c${p.name}`, consoleColors.info, consoleColors.recognized);
        SpessaSynthInfo(`Keys for ${p.name}:`, combos);
        let trimmedZones = 0;
        for (let zoneIndex = 0;zoneIndex < p.zones.length; zoneIndex++) {
          const zone = p.zones[zoneIndex];
          const keyRange = zone.keyRange;
          const velRange = zone.velRange;
          let isZoneUsed = false;
          for (const combo of combos) {
            if (combo.key >= keyRange.min && combo.key <= keyRange.max && combo.velocity >= velRange.min && combo.velocity <= velRange.max && zone.instrument) {
              isZoneUsed = true;
              const trimmedIZones = trimInstrumentZones(zone.instrument, combos);
              SpessaSynthInfo(`%cTrimmed off %c${trimmedIZones}%c zones from %c${zone.instrument.name}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
              break;
            }
          }
          if (!isZoneUsed && zone.instrument) {
            trimmedZones++;
            p.deleteZone(zoneIndex);
            if (zone.instrument.useCount < 1) {
              this.deleteInstrument(zone.instrument);
            }
            zoneIndex--;
          }
        }
        SpessaSynthInfo(`%cTrimmed off %c${trimmedZones}%c zones from %c${p.name}`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized);
        SpessaSynthGroupEnd();
      }
    }
    this.removeUnusedElements();
    SpessaSynthInfo("%cSound bank modified!", consoleColors.recognized);
    SpessaSynthGroupEnd();
    SpessaSynthGroupEnd();
  }
  removeUnusedElements() {
    this.instruments = this.instruments.filter((i) => {
      i.deleteUnusedZones();
      const deletable = i.useCount < 1;
      if (deletable) {
        i.delete();
      }
      return !deletable;
    });
    this.samples = this.samples.filter((s) => {
      const deletable = s.useCount < 1;
      if (deletable) {
        s.unlinkSample();
      }
      return !deletable;
    });
  }
  deleteInstrument(instrument) {
    instrument.delete();
    this.instruments.splice(this.instruments.indexOf(instrument), 1);
  }
  deletePreset(preset) {
    preset.delete();
    this.presets.splice(this.presets.indexOf(preset), 1);
  }
  deleteSample(sample) {
    sample.unlinkSample();
    this.samples.splice(this.samples.indexOf(sample), 1);
  }
  getPreset(patch, system) {
    return selectPreset(this.presets, patch, system);
  }
  destroySoundBank() {
    this.presets.length = 0;
    this.instruments.length = 0;
    this.samples.length = 0;
  }
  parsingError(error) {
    throw new Error(`SF parsing error: ${error} The file may be corrupted.`);
  }
  parseInternal() {
    this._isXGBank = false;
    const allowedPrograms = /* @__PURE__ */ new Set([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      16,
      17,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      40,
      41,
      48,
      56,
      57,
      58,
      64,
      65,
      66,
      126,
      127
    ]);
    for (const preset of this.presets) {
      if (BankSelectHacks.isXGDrums(preset.bankMSB)) {
        this._isXGBank = true;
        if (!allowedPrograms.has(preset.program)) {
          this._isXGBank = false;
          SpessaSynthInfo(`%cThis bank is not valid XG. Preset %c${preset.toString()}%c is not a valid XG drum. XG mode will use presets on bank 128.`, consoleColors.info, consoleColors.value, consoleColors.info);
          break;
        }
      }
    }
  }
  printInfo() {
    for (const [info, value] of Object.entries(this.soundBankInfo)) {
      if (typeof value === "object" && "major" in value) {
        const v = value;
        SpessaSynthInfo(`%c${info}: %c"${v.major}.${v.minor}"`, consoleColors.info, consoleColors.recognized);
      }
      SpessaSynthInfo(`%c${info}: %c${value.toLocaleString()}`, consoleColors.info, consoleColors.recognized);
    }
  }
};
var ReadGenerator = class extends Generator {
  constructor(dataArray) {
    const i = dataArray.currentIndex;
    const generatorType = dataArray[i + 1] << 8 | dataArray[i];
    const generatorValue = signedInt16(dataArray[i + 2], dataArray[i + 3]);
    dataArray.currentIndex += 4;
    super(generatorType, generatorValue, false);
  }
};
function readGenerators(generatorChunk) {
  const gens = [];
  while (generatorChunk.data.length > generatorChunk.data.currentIndex) {
    gens.push(new ReadGenerator(generatorChunk.data));
  }
  gens.pop();
  return gens;
}
var SoundFontPresetZone = class extends BasicPresetZone {
  constructor(preset, modulators, generators, instruments) {
    const instrumentID = generators.find((g) => g.generatorType === generatorTypes.instrument);
    let instrument = undefined;
    if (instrumentID) {
      instrument = instruments[instrumentID.generatorValue];
    } else {
      throw new Error("No instrument ID found in preset zone.");
    }
    if (!instrument) {
      throw new Error(`Invalid instrument ID: ${instrumentID.generatorValue}, available instruments: ${instruments.length}`);
    }
    super(preset, instrument);
    this.addGenerators(...generators);
    this.addModulators(...modulators);
  }
};
function applyPresetZones(indexes, presetGens, presetMods, instruments, presets) {
  const genStartIndexes = indexes.gen;
  const modStartIndexes = indexes.mod;
  let modIndex = 0;
  let genIndex = 0;
  for (const preset of presets) {
    for (let i = 0;i < preset.zonesCount; i++) {
      const gensStart = genStartIndexes[genIndex++];
      const gensEnd = genStartIndexes[genIndex];
      const gens = presetGens.slice(gensStart, gensEnd);
      const modsStart = modStartIndexes[modIndex++];
      const modsEnd = modStartIndexes[modIndex];
      const mods = presetMods.slice(modsStart, modsEnd);
      if (gens.find((g) => g.generatorType === generatorTypes.instrument) !== undefined) {
        preset.createSoundFontZone(mods, gens, instruments);
      } else {
        preset.globalZone.addGenerators(...gens);
        preset.globalZone.addModulators(...mods);
      }
    }
  }
}
var SoundFontPreset = class extends BasicPreset {
  zoneStartIndex;
  zonesCount = 0;
  constructor(presetChunk, sf2) {
    super(sf2);
    this.name = readBinaryStringIndexed(presetChunk.data, 20).replace(/\d{3}:\d{3}/, "");
    this.program = readLittleEndianIndexed(presetChunk.data, 2);
    const wBank = readLittleEndianIndexed(presetChunk.data, 2);
    this.bankMSB = wBank & 127;
    this.isGMGSDrum = (wBank & 128) > 0;
    this.bankLSB = wBank >> 8;
    this.zoneStartIndex = readLittleEndianIndexed(presetChunk.data, 2);
    this.library = readLittleEndianIndexed(presetChunk.data, 4);
    this.genre = readLittleEndianIndexed(presetChunk.data, 4);
    this.morphology = readLittleEndianIndexed(presetChunk.data, 4);
  }
  createSoundFontZone(modulators, generators, instruments) {
    const z = new SoundFontPresetZone(this, modulators, generators, instruments);
    this.zones.push(z);
    return z;
  }
};
function readPresets(presetChunk, parent) {
  const presets = [];
  while (presetChunk.data.length > presetChunk.data.currentIndex) {
    const preset = new SoundFontPreset(presetChunk, parent);
    if (presets.length > 0) {
      const previous = presets[presets.length - 1];
      previous.zonesCount = preset.zoneStartIndex - previous.zoneStartIndex;
    }
    presets.push(preset);
  }
  presets.pop();
  return presets;
}
var SoundFontInstrumentZone = class extends BasicInstrumentZone {
  constructor(inst, modulators, generators, samples) {
    const sampleID = generators.find((g) => g.generatorType === generatorTypes.sampleID);
    let sample = undefined;
    if (sampleID) {
      sample = samples[sampleID.generatorValue];
    } else {
      throw new Error("No sample ID found in instrument zone.");
    }
    if (!sample) {
      throw new Error(`Invalid sample ID: ${sampleID.generatorValue}, available samples: ${samples.length}`);
    }
    super(inst, sample);
    this.addGenerators(...generators);
    this.addModulators(...modulators);
  }
};
function applyInstrumentZones(indexes, instrumentGenerators, instrumentModulators, samples, instruments) {
  const genStartIndexes = indexes.gen;
  const modStartIndexes = indexes.mod;
  let modIndex = 0;
  let genIndex = 0;
  for (const instrument of instruments) {
    for (let i = 0;i < instrument.zonesCount; i++) {
      const gensStart = genStartIndexes[genIndex++];
      const gensEnd = genStartIndexes[genIndex];
      const gens = instrumentGenerators.slice(gensStart, gensEnd);
      const modsStart = modStartIndexes[modIndex++];
      const modsEnd = modStartIndexes[modIndex];
      const mods = instrumentModulators.slice(modsStart, modsEnd);
      if (gens.find((g) => g.generatorType === generatorTypes.sampleID)) {
        instrument.createSoundFontZone(mods, gens, samples);
      } else {
        instrument.globalZone.addGenerators(...gens);
        instrument.globalZone.addModulators(...mods);
      }
    }
  }
}
var SoundFontInstrument = class extends BasicInstrument {
  zoneStartIndex;
  zonesCount = 0;
  constructor(instrumentChunk) {
    super();
    this.name = readBinaryStringIndexed(instrumentChunk.data, 20);
    this.zoneStartIndex = readLittleEndianIndexed(instrumentChunk.data, 2);
  }
  createSoundFontZone(modulators, generators, samples) {
    const z = new SoundFontInstrumentZone(this, modulators, generators, samples);
    this.zones.push(z);
    return z;
  }
};
function readInstruments(instrumentChunk) {
  const instruments = [];
  while (instrumentChunk.data.length > instrumentChunk.data.currentIndex) {
    const instrument = new SoundFontInstrument(instrumentChunk);
    if (instruments.length > 0) {
      const previous = instruments[instruments.length - 1];
      previous.zonesCount = instrument.zoneStartIndex - previous.zoneStartIndex;
    }
    instruments.push(instrument);
  }
  instruments.pop();
  return instruments;
}
function readModulators(modulatorChunk) {
  const mods = [];
  while (modulatorChunk.data.length > modulatorChunk.data.currentIndex) {
    const dataArray = modulatorChunk.data;
    const sourceEnum = readLittleEndianIndexed(dataArray, 2);
    const destination = readLittleEndianIndexed(dataArray, 2);
    const amount = signedInt16(dataArray[dataArray.currentIndex++], dataArray[dataArray.currentIndex++]);
    const secondarySourceEnum = readLittleEndianIndexed(dataArray, 2);
    const transformType = readLittleEndianIndexed(dataArray, 2);
    mods.push(new DecodedModulator(sourceEnum, secondarySourceEnum, destination, amount, transformType));
  }
  mods.pop();
  return mods;
}
function readZoneIndexes(zonesChunk) {
  const modStartIndexes = [];
  const genStartIndexes = [];
  while (zonesChunk.data.length > zonesChunk.data.currentIndex) {
    genStartIndexes.push(readLittleEndianIndexed(zonesChunk.data, 2));
    modStartIndexes.push(readLittleEndianIndexed(zonesChunk.data, 2));
  }
  return {
    mod: modStartIndexes,
    gen: genStartIndexes
  };
}
var SoundFont2 = class extends BasicSoundBank {
  sampleDataStartIndex = 0;
  constructor(arrayBuffer, warnDeprecated = true) {
    super();
    if (warnDeprecated) {
      throw new Error("Using the constructor directly is deprecated. Use SoundBankLoader.fromArrayBuffer() instead.");
    }
    const mainFileArray = new IndexedByteArray(arrayBuffer);
    SpessaSynthGroup("%cParsing a SoundFont2 file...", consoleColors.info);
    if (!mainFileArray) {
      SpessaSynthGroupEnd();
      this.parsingError("No data provided!");
    }
    const firstChunk = readRIFFChunk(mainFileArray, false);
    this.verifyHeader(firstChunk, "riff");
    const type = readBinaryStringIndexed(mainFileArray, 4).toLowerCase();
    if (type !== "sfbk" && type !== "sfpk") {
      SpessaSynthGroupEnd();
      throw new SyntaxError(`Invalid soundFont! Expected "sfbk" or "sfpk" got "${type}"`);
    }
    const isSF2Pack = type === "sfpk";
    const infoChunk = readRIFFChunk(mainFileArray);
    this.verifyHeader(infoChunk, "list");
    const infoString = readBinaryStringIndexed(infoChunk.data, 4);
    if (infoString !== "INFO") {
      SpessaSynthGroupEnd();
      throw new SyntaxError(`Invalid soundFont! Expected "INFO" or "${infoString}"`);
    }
    let xdtaChunk = undefined;
    while (infoChunk.data.length > infoChunk.data.currentIndex) {
      const chunk = readRIFFChunk(infoChunk.data);
      const text = readBinaryString(chunk.data, chunk.data.length);
      const headerTyped = chunk.header;
      switch (headerTyped) {
        case "ifil":
        case "iver":
          const major = readLittleEndianIndexed(chunk.data, 2);
          const minor = readLittleEndianIndexed(chunk.data, 2);
          if (headerTyped === "ifil") {
            this.soundBankInfo.version = {
              major,
              minor
            };
          } else {
            this.soundBankInfo.romVersion = {
              major,
              minor
            };
          }
          break;
        case "DMOD": {
          this.defaultModulators = readModulators(chunk);
          this.customDefaultModulators = true;
          break;
        }
        case "LIST": {
          const listType = readBinaryStringIndexed(chunk.data, 4);
          if (listType === "xdta") {
            SpessaSynthInfo("%cExtended SF2 found!", consoleColors.recognized);
            xdtaChunk = chunk;
          }
          break;
        }
        case "ICRD":
          this.soundBankInfo.creationDate = parseDateString(readBinaryStringIndexed(chunk.data, chunk.data.length));
          break;
        case "ISFT":
          this.soundBankInfo.software = text;
          break;
        case "IPRD":
          this.soundBankInfo.product = text;
          break;
        case "IENG":
          this.soundBankInfo.engineer = text;
          break;
        case "ICOP":
          this.soundBankInfo.copyright = text;
          break;
        case "INAM":
          this.soundBankInfo.name = text;
          break;
        case "ICMT":
          this.soundBankInfo.comment = text;
          break;
        case "irom":
          this.soundBankInfo.romInfo = text;
          break;
        case "isng":
          this.soundBankInfo.soundEngine = text;
      }
    }
    this.printInfo();
    const xChunks = {};
    if (xdtaChunk !== undefined) {
      xChunks.phdr = readRIFFChunk(xdtaChunk.data);
      xChunks.pbag = readRIFFChunk(xdtaChunk.data);
      xChunks.pmod = readRIFFChunk(xdtaChunk.data);
      xChunks.pgen = readRIFFChunk(xdtaChunk.data);
      xChunks.inst = readRIFFChunk(xdtaChunk.data);
      xChunks.ibag = readRIFFChunk(xdtaChunk.data);
      xChunks.imod = readRIFFChunk(xdtaChunk.data);
      xChunks.igen = readRIFFChunk(xdtaChunk.data);
      xChunks.shdr = readRIFFChunk(xdtaChunk.data);
    }
    const sdtaChunk = readRIFFChunk(mainFileArray, false);
    this.verifyHeader(sdtaChunk, "list");
    this.verifyText(readBinaryStringIndexed(mainFileArray, 4), "sdta");
    SpessaSynthInfo("%cVerifying smpl chunk...", consoleColors.warn);
    const sampleDataChunk = readRIFFChunk(mainFileArray, false);
    this.verifyHeader(sampleDataChunk, "smpl");
    let sampleData;
    if (isSF2Pack) {
      SpessaSynthInfo("%cSF2Pack detected, attempting to decode the smpl chunk...", consoleColors.info);
      try {
        sampleData = stb.decode(mainFileArray.buffer.slice(mainFileArray.currentIndex, mainFileArray.currentIndex + sdtaChunk.size - 12)).data[0];
      } catch (e) {
        SpessaSynthGroupEnd();
        throw new Error(`SF2Pack Ogg Vorbis decode error: ${e}`);
      }
      SpessaSynthInfo(`%cDecoded the smpl chunk! Length: %c${sampleData.length}`, consoleColors.info, consoleColors.value);
    } else {
      sampleData = mainFileArray;
      this.sampleDataStartIndex = mainFileArray.currentIndex;
    }
    SpessaSynthInfo(`%cSkipping sample chunk, length: %c${sdtaChunk.size - 12}`, consoleColors.info, consoleColors.value);
    mainFileArray.currentIndex += sdtaChunk.size - 12;
    SpessaSynthInfo("%cLoading preset data chunk...", consoleColors.warn);
    const presetChunk = readRIFFChunk(mainFileArray);
    this.verifyHeader(presetChunk, "list");
    readBinaryStringIndexed(presetChunk.data, 4);
    const phdrChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(phdrChunk, "phdr");
    const pbagChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(pbagChunk, "pbag");
    const pmodChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(pmodChunk, "pmod");
    const pgenChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(pgenChunk, "pgen");
    const instChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(instChunk, "inst");
    const ibagChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(ibagChunk, "ibag");
    const imodChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(imodChunk, "imod");
    const igenChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(igenChunk, "igen");
    const shdrChunk = readRIFFChunk(presetChunk.data);
    this.verifyHeader(shdrChunk, "shdr");
    SpessaSynthInfo("%cParsing samples...", consoleColors.info);
    mainFileArray.currentIndex = this.sampleDataStartIndex;
    const samples = readSamples(shdrChunk, sampleData, xdtaChunk === undefined);
    if (xdtaChunk && xChunks.shdr) {
      const xSamples = readSamples(xChunks.shdr, new Float32Array(1), false);
      if (xSamples.length === samples.length) {
        samples.forEach((s, i) => {
          s.name += xSamples[i].name;
          s.linkedSampleIndex |= xSamples[i].linkedSampleIndex << 16;
        });
      }
    }
    samples.forEach((s) => s.name = s.name.trim());
    this.samples.push(...samples);
    const instrumentGenerators = readGenerators(igenChunk);
    const instrumentModulators = readModulators(imodChunk);
    const instruments = readInstruments(instChunk);
    if (xdtaChunk && xChunks.inst) {
      const xInst = readInstruments(xChunks.inst);
      if (xInst.length === instruments.length) {
        instruments.forEach((inst, i) => {
          inst.name += xInst[i].name;
          inst.zoneStartIndex |= xInst[i].zoneStartIndex;
        });
        instruments.forEach((inst, i) => {
          if (i < instruments.length - 1) {
            inst.zonesCount = instruments[i + 1].zoneStartIndex - inst.zoneStartIndex;
          }
        });
      }
    }
    instruments.forEach((i) => i.name = i.name.trim());
    this.instruments.push(...instruments);
    const ibagIndexes = readZoneIndexes(ibagChunk);
    if (xdtaChunk && xChunks.ibag) {
      const extraIndexes = readZoneIndexes(xChunks.ibag);
      for (let i = 0;i < ibagIndexes.mod.length; i++) {
        ibagIndexes.mod[i] |= extraIndexes.mod[i] << 16;
      }
      for (let i = 0;i < ibagIndexes.gen.length; i++) {
        ibagIndexes.gen[i] |= extraIndexes.gen[i] << 16;
      }
    }
    applyInstrumentZones(ibagIndexes, instrumentGenerators, instrumentModulators, this.samples, instruments);
    const presetGenerators = readGenerators(pgenChunk);
    const presetModulators = readModulators(pmodChunk);
    const presets = readPresets(phdrChunk, this);
    if (xdtaChunk && xChunks.phdr) {
      const xPreset = readPresets(xChunks.phdr, this);
      if (xPreset.length === presets.length) {
        presets.forEach((pres, i) => {
          pres.name += xPreset[i].name;
          pres.zoneStartIndex |= xPreset[i].zoneStartIndex;
        });
        presets.forEach((preset, i) => {
          if (i < presets.length - 1) {
            preset.zonesCount = presets[i + 1].zoneStartIndex - preset.zoneStartIndex;
          }
        });
      }
    }
    presets.forEach((p) => p.name === p.name.trim());
    this.addPresets(...presets);
    const pbagIndexes = readZoneIndexes(pbagChunk);
    if (xdtaChunk && xChunks.pbag) {
      const extraIndexes = readZoneIndexes(xChunks.pbag);
      for (let i = 0;i < pbagIndexes.mod.length; i++) {
        pbagIndexes.mod[i] |= extraIndexes.mod[i] << 16;
      }
      for (let i = 0;i < pbagIndexes.gen.length; i++) {
        pbagIndexes.gen[i] |= extraIndexes.gen[i] << 16;
      }
    }
    applyPresetZones(pbagIndexes, presetGenerators, presetModulators, this.instruments, presets);
    this.flush();
    SpessaSynthInfo(`%cParsing finished! %c"${this.soundBankInfo.name}"%c has %c${this.presets.length}%c presets,
        %c${this.instruments.length}%c instruments and %c${this.samples.length}%c samples.`, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info, consoleColors.recognized, consoleColors.info);
    SpessaSynthGroupEnd();
  }
  verifyHeader(chunk, expected) {
    if (chunk.header.toLowerCase() !== expected.toLowerCase()) {
      SpessaSynthGroupEnd();
      this.parsingError(`Invalid chunk header! Expected "${expected.toLowerCase()}" got "${chunk.header.toLowerCase()}"`);
    }
  }
  verifyText(text, expected) {
    if (text.toLowerCase() !== expected.toLowerCase()) {
      SpessaSynthGroupEnd();
      this.parsingError(`Invalid FourCC: Expected "${expected.toLowerCase()}" got "${text.toLowerCase()}"\``);
    }
  }
};
var SoundBankLoader = class {
  static fromArrayBuffer(buffer) {
    const check = buffer.slice(8, 12);
    const a = new IndexedByteArray(check);
    const id = readBinaryStringIndexed(a, 4).toLowerCase();
    if (id === "dls ") {
      return this.loadDLS(buffer);
    }
    return new SoundFont2(buffer, false);
  }
  static loadDLS(buffer) {
    const dls = DownloadableSounds.read(buffer);
    return dls.toSF();
  }
};
var SpessaSynthProcessor3 = class {
  soundBankManager = new SoundBankManager(this.updatePresetList.bind(this));
  midiChannels = [];
  keyModifierManager = new KeyModifierManager;
  totalVoicesAmount = 0;
  processorInitialized = stb.isInitialized;
  currentSynthTime = 0;
  sampleRate;
  enableEffects = true;
  enableEventSystem;
  onEventCall;
  systemExclusive = systemExclusiveInternal.bind(this);
  resetAllControllers = resetAllControllersInternal.bind(this);
  setMasterParameter = setMasterParameterInternal.bind(this);
  getMasterParameter = getMasterParameterInternal.bind(this);
  getAllMasterParameters = getAllMasterParametersInternal.bind(this);
  getVoicesForPreset = getVoicesForPresetInternal.bind(this);
  killVoices = killVoicesIntenral.bind(this);
  getVoices = getVoicesInternal.bind(this);
  privateProps;
  savedSnapshot;
  eventQueue = [];
  sampleTime;
  constructor(sampleRate, opts = DEFAULT_SYNTH_OPTIONS) {
    const options = fillWithDefaults(opts, DEFAULT_SYNTH_OPTIONS);
    this.enableEffects = options.enableEffects;
    this.enableEventSystem = options.enableEventSystem;
    this.currentSynthTime = options.initialTime;
    this.sampleRate = sampleRate;
    this.sampleTime = 1 / sampleRate;
    if (isNaN(options.initialTime) || isNaN(sampleRate)) {
      throw new Error("Initial time or sample rate is NaN!");
    }
    this.privateProps = new ProtectedSynthValues(this.callEvent.bind(this), this.getVoices.bind(this), this.killVoices.bind(this), VOLUME_ENVELOPE_SMOOTHING_FACTOR * (44100 / sampleRate), PAN_SMOOTHING_FACTOR * (44100 / sampleRate), FILTER_SMOOTHING_FACTOR * (44100 / sampleRate));
    for (let i = 0;i < MIDI_CHANNEL_COUNT; i++) {
      this.createMIDIChannelInternal(false);
    }
    this.processorInitialized.then(() => {
      SpessaSynthInfo("%cSpessaSynth is ready!", consoleColors.recognized);
    });
  }
  applySynthesizerSnapshot(snapshot) {
    this.savedSnapshot = snapshot;
    snapshot.apply(this);
    SpessaSynthInfo("%cFinished applying snapshot!", consoleColors.info);
    this.resetAllControllers();
  }
  getSnapshot() {
    return SynthesizerSnapshot.create(this);
  }
  setEmbeddedSoundBank(bank, offset) {
    const loadedFont = SoundBankLoader.fromArrayBuffer(bank);
    this.soundBankManager.addSoundBank(loadedFont, EMBEDDED_SOUND_BANK_ID, offset);
    const order = this.soundBankManager.priorityOrder;
    order.pop();
    order.unshift(EMBEDDED_SOUND_BANK_ID);
    this.soundBankManager.priorityOrder = order;
    if (this.savedSnapshot !== undefined) {
      this.applySynthesizerSnapshot(this.savedSnapshot);
    }
    SpessaSynthInfo(`%cEmbedded sound bank set at offset %c${offset}`, consoleColors.recognized, consoleColors.value);
  }
  clearEmbeddedBank() {
    if (this.soundBankManager.soundBankList.some((s) => s.id === EMBEDDED_SOUND_BANK_ID)) {
      this.soundBankManager.deleteSoundBank(EMBEDDED_SOUND_BANK_ID);
    }
  }
  createMIDIChannel() {
    this.createMIDIChannelInternal(true);
  }
  stopAllChannels(force = false) {
    SpessaSynthInfo("%cStop all received!", consoleColors.info);
    for (const channel of this.midiChannels) {
      channel.stopAllNotes(force);
    }
  }
  renderAudio(outputs, reverb, chorus, startIndex = 0, sampleCount = 0) {
    this.renderAudioSplit(reverb, chorus, Array(16).fill(outputs), startIndex, sampleCount);
  }
  renderAudioSplit(reverbChannels, chorusChannels, separateChannels, startIndex = 0, sampleCount = 0) {
    const time = this.currentSynthTime;
    while (this.eventQueue[0]?.time <= time) {
      this.eventQueue.shift()?.callback();
    }
    const revL = reverbChannels[0];
    const revR = reverbChannels[1];
    const chrL = chorusChannels[0];
    const chrR = chorusChannels[1];
    startIndex = Math.max(startIndex, 0);
    const quantumSize = sampleCount || separateChannels[0][0].length - startIndex;
    this.totalVoicesAmount = 0;
    this.midiChannels.forEach((channel, index) => {
      if (channel.voices.length < 1 || channel.isMuted) {
        return;
      }
      const voiceCount = channel.voices.length;
      const ch = index % 16;
      channel.renderAudio(separateChannels[ch][0], separateChannels[ch][1], revL, revR, chrL, chrR, startIndex, quantumSize);
      this.totalVoicesAmount += channel.voices.length;
      if (channel.voices.length !== voiceCount) {
        channel.sendChannelProperty();
      }
    });
    this.currentSynthTime += quantumSize * this.sampleTime;
  }
  destroySynthProcessor() {
    this.midiChannels.forEach((c) => {
      c.voices.length = 0;
      c.sustainedVoices.length = 0;
      c.lockedControllers = [];
      c.preset = undefined;
    });
    this.clearCache();
    this.midiChannels.length = 0;
    this.soundBankManager.destroy();
  }
  controllerChange(channel, controllerNumber, controllerValue) {
    this.midiChannels[channel].controllerChange(controllerNumber, controllerValue);
  }
  noteOn(channel, midiNote, velocity) {
    this.midiChannels[channel].noteOn(midiNote, velocity);
  }
  noteOff(channel, midiNote) {
    this.midiChannels[channel].noteOff(midiNote);
  }
  polyPressure(channel, midiNote, pressure) {
    this.midiChannels[channel].polyPressure(midiNote, pressure);
  }
  channelPressure(channel, pressure) {
    this.midiChannels[channel].channelPressure(pressure);
  }
  pitchWheel(channel, pitch) {
    this.midiChannels[channel].pitchWheel(pitch);
  }
  programChange(channel, programNumber) {
    this.midiChannels[channel].programChange(programNumber);
  }
  processMessage(message, channelOffset = 0, force = false, options = DEFAULT_SYNTH_METHOD_OPTIONS) {
    const call = () => {
      const statusByteData = getEvent(message[0]);
      const channel = statusByteData.channel + channelOffset;
      switch (statusByteData.status) {
        case midiMessageTypes.noteOn: {
          const velocity = message[2];
          if (velocity > 0) {
            this.noteOn(channel, message[1], velocity);
          } else {
            this.noteOff(channel, message[1]);
          }
          break;
        }
        case midiMessageTypes.noteOff:
          if (force) {
            this.midiChannels[channel].killNote(message[1]);
          } else {
            this.noteOff(channel, message[1]);
          }
          break;
        case midiMessageTypes.pitchWheel:
          this.pitchWheel(channel, message[2] << 7 | message[1]);
          break;
        case midiMessageTypes.controllerChange:
          this.controllerChange(channel, message[1], message[2]);
          break;
        case midiMessageTypes.programChange:
          this.programChange(channel, message[1]);
          break;
        case midiMessageTypes.polyPressure:
          this.polyPressure(channel, message[0], message[1]);
          break;
        case midiMessageTypes.channelPressure:
          this.channelPressure(channel, message[1]);
          break;
        case midiMessageTypes.systemExclusive:
          this.systemExclusive(new IndexedByteArray(message.slice(1)), channelOffset);
          break;
        case midiMessageTypes.reset:
          this.stopAllChannels();
          this.resetAllControllers();
          break;
        default:
          break;
      }
    };
    const time = options.time;
    if (time > this.currentSynthTime) {
      this.eventQueue.push({
        callback: call.bind(this),
        time
      });
      this.eventQueue.sort((e1, e2) => e1.time - e2.time);
    } else {
      call();
    }
  }
  clearCache() {
    this.privateProps.cachedVoices = [];
  }
  setMIDIVolume(volume) {
    this.privateProps.midiVolume = Math.pow(volume, Math.E);
  }
  setMasterTuning(cents) {
    cents = Math.round(cents);
    for (const channel of this.midiChannels) {
      channel.setCustomController(customControllers.masterTuning, cents);
    }
  }
  callEvent(eventName, eventData) {
    this.onEventCall?.({
      type: eventName,
      data: eventData
    });
  }
  getCachedVoice(patch, midiNote, velocity) {
    return this.privateProps.cachedVoices?.[this.getCachedVoiceIndex(patch, midiNote, velocity)];
  }
  setCachedVoice(patch, midiNote, velocity, voices) {
    this.privateProps.cachedVoices[this.getCachedVoiceIndex(patch, midiNote, velocity)] = voices;
  }
  getCachedVoiceIndex(patch, midiNote, velocity) {
    let bankMSB = patch.bankMSB;
    let bankLSB = patch.bankLSB;
    const { isGMGSDrum, program } = patch;
    if (isGMGSDrum) {
      bankMSB = 128;
      bankLSB = 0;
    }
    return bankMSB + bankLSB * 128 + program * 16384 + 2097152 * midiNote + 268435456 * velocity;
  }
  createMIDIChannelInternal(sendEvent) {
    const channel = new MIDIChannel(this, this.privateProps, this.privateProps.defaultPreset, this.midiChannels.length);
    this.midiChannels.push(channel);
    if (sendEvent) {
      this.callEvent("newChannel", undefined);
      channel.sendChannelProperty();
      this.midiChannels[this.midiChannels.length - 1].setDrums(true);
    }
  }
  updatePresetList() {
    const mainFont = this.soundBankManager.presetList;
    this.clearCache();
    this.privateProps.callEvent("presetListChange", mainFont);
    this.getDefaultPresets();
    this.midiChannels.forEach((c) => {
      c.setPresetLock(false);
    });
    this.resetAllControllers();
  }
  getDefaultPresets() {
    this.privateProps.defaultPreset = this.soundBankManager.getPreset({
      bankLSB: 0,
      bankMSB: 0,
      program: 0,
      isGMGSDrum: false
    }, "xg");
    this.privateProps.drumPreset = this.soundBankManager.getPreset({
      bankLSB: 0,
      bankMSB: 0,
      program: 0,
      isGMGSDrum: true
    }, "gs");
  }
};
export {
  SoundBankLoader,
  BasicSoundBank
};
