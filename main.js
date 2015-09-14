function ajax(url, callback) {
	var oReq = new XMLHttpRequest();
	oReq.open('GET', url, true);
	oReq.responseType = 'arraybuffer';

	oReq.onload = function(oEvent) {
		console.log('ajax done for ', url);
		var arrayBuffer = oReq.response;
		callback(arrayBuffer);
	};

	oReq.send();
}

ajax('samples/anongs.nwc', received);

function hex(number) {
	return ('00' + (number || 0).toString(16)).slice(-2);
}

function binary(number) {
	return ('00000000' + (number || 0).toString(2)).slice(-8);
}

function string(number) {
	return (' ' + String.fromCharCode(number)).slice(-1);
}

function num(number) {
	return ('  ' + number).slice(-3);
}

function dump(byteArray, start) {
	var limit = 20;
	start = start || 0;
	for (var i = start, lim = 0; i < byteArray.length, lim < limit; i+=4, lim++) {
		console.log(
			// '%c' + i, 'background: #222; color: #bada55',
			('000' + i + ')').slice(-4),

			hex(byteArray[i]),
			hex(byteArray[i + 1]),
			hex(byteArray[i + 2]),
			hex(byteArray[i + 3]),

			binary(byteArray[i]),
			binary(byteArray[i + 1]),
			binary(byteArray[i + 2]),
			binary(byteArray[i + 3]),

			string(byteArray[i]),
			string(byteArray[i + 1]),
			string(byteArray[i + 2]),
			string(byteArray[i + 3]),

			num(byteArray[i]),
			num(byteArray[i + 1]),
			num(byteArray[i + 2]),
			num(byteArray[i + 3])
		);
	}

}

function received(arrayBuffer) {
	var byteArray = new Uint8Array(arrayBuffer);
	var firstBytes = shortArrayToString(byteArray.subarray(0, 5));
	if ('[NWZ]' === firstBytes) {
		var nwz = byteArray.subarray(6);
		var inflate = new Zlib.Inflate(nwz);
		var plain = inflate.decompress();
		process(plain);
	} else if ('[Note' === firstBytes) {
		process(byteArray);
	} else {
		console.log('Unrecognized headers');
	}
}

function shortArrayToString(array) {
	return String.fromCharCode.apply(null, array);
}

var STYLES = [
	'Regular',
	'Italic',
	'Bold',
	'Bold Italic'
];

var ENDINGS = [
	'SectionClose',
	'MasterRepeatClose',
	'Single',
	'Double',
	'Open hidden'
];

function process(array) {
	a = array;

	var lex = new Lex(array);
	Header(lex);
	Info(lex);
	PageSetup(lex);
	Staff(lex);
}

function Header(lex) {
	lex.descend('header');
	lex.emit('company', lex.readLineString());
	var skip = shortArrayToString(lex.readLine());
	skip = shortArrayToString(lex.readLine());
	lex.emit('product', lex.readLineString());

	var v = lex.readLine();

	lex.skip(2);
	lex.emit('name1', lex.readLineString());
	lex.emit('name2', lex.readLineString());
	lex.skip(8);
	lex.skip(2);

	var version_minor = v[0];
	var version_major = v[1];
	version = version_major + version_minor * 0.01;
	lex.emit('version', version);
}

function Info(lex) {
	lex.descend('info');
	lex.emit('title', lex.readLineString());
	lex.emit('author', lex.readLineString());
	lex.emit('copyright1', lex.readLineString());
	lex.emit('copyright2', lex.readLineString());
	if (version >= 2) {
		lex.emit('something', lex.readLineString());
	}
	lex.emit('comments', lex.readLineString());
	console.log(lex.data);
}

function PageSetup(lex) {
	lex.descend('page_setup');
	margins = Margins(lex);
	staffSize = Fonts(lex);
}

function Margins(lex) {
	lex.skip(9);
	lex.emit('measureStart', lex.readByte());
	lex.skip(1); // likely 0
	margins = lex.readLineString();
	margins = margins.split(' ').map(function(x) {
		return +x;
	});
	lex.emit('margins', margins);
}

function Fonts(lex) {
	lex.skip(36);
	lex.emit('staff_size', lex.readByte());
	lex.skip(1);

	var fonts = [], font, style, size, typeface;
	for (var i = 0; i < 12; i++) {
		font = lex.readLineString();
		style = STYLES[lex.readByte() & 3];
		size = lex.readByte();
		lex.skip(1);
		typeface = lex.readByte();

		fonts.push({
			font: font,
			style: style,
			size: size,
			typeface: typeface
		});
	}
	lex.emit('fonts', fonts);
}

function Staff(lex) {
	lex.descend('staff');
	lex.readUntil(0xff);

	lex.readBytes(2);
	lex.emit('layering', lex.readByte(1));
	var staves = lex.readByte(1);
	lex.emit('staves', staves);
	lex.skip(1);

	for (var i = 1; i <= staves; i++) {
		StaffInfo(lex, i);
	}

}

function StaffInfo(lex, staff) {
	lex.descend('staff-' + staff);
	lex.emit('staff_name', lex.readLineString());
	lex.emit('group_name', lex.readLineString());
	lex.emit('end_bar', lex.readByte() & 7);
	lex.emit('muted', !!(lex.readByte() & 1));
	lex.skip(1);
	lex.emit('channel', lex.readByte());
	lex.skip(9);
	lex.emit('staff_type', lex.readByte() & 3);
	lex.skip(1);

	lex.emit('uppersize', 256 - lex.readByte());
	lex.readUntil(0xff);
	lex.emit('lowersize', lex.readByte());
	lex.skip(1);
	lex.emit('lines', lex.readByte());
	lex.emit('layer', !!(lex.readByte() & 1));
	lex.emit('part_volume', lex.readByte());
	lex.skip(1);
	lex.emit('stero_pan', lex.readByte());
	if (lex.data.header.version === 1.7) {
		lex.skip(2);
	} else {
		lex.skip(3);
	}

	lex.skip(2);
	var lyrics = lex.readShort();
	var noLyrics = lex.readShort();

	console.log('noLyrics' ,noLyrics);

	if (lyrics) {
		var lyricsOption = lex.readShort();
		lex.skip(3);

		for (var i = 0; i < noLyrics; i++) {
			var lyrics = [];
			lyrics.push(Lyrics(lex));
			lex.emit('lyrics', lyrics);
		}
		lex.skip(1);
	}

	lex.skip();
	lex.emit('color', lex.readByte() & 3);

	var tokens = lex.readShort();
	lex.emit('tokens', tokens);

	while (token--) {
		if (lex.data.header.version === 1.7) {
			lex.skip(2);
		}
		var token = lex.readByte();
	}
}

var TOKENS = {
	0: 'Clef',
	1: 'KeySignature',
	2: 'Barline',
	3: 'Repeat',
	4: 'InstrumentPath',
	5: ''
};

function Lyrics(lex) {
	var data = lex.readByte();
	if (!data) return;

	var blocks;
	switch (lex.readByte()) {
		case 4:
			blocks = 1;
			break;
		case 8:
			blocks = 1;
			break;
		default:
			return;
	}

	dump(lex.array, lex.start);

	var lyricsLen = lex.readShort();
	lex.skip(1);

	var chunk = lex.readBytes(1024 * blocks);
	var cs = shortArrayToString(chunk);
	console.log('cs', cs, cs.toString(16));
	var lyrics = chunk.subarray(0, lyricsLen);
	return shortArrayToString(lyrics);
}

// processStaff
// findStaffInfo

function Lex(array) {
	this.array = array;
	this.start = 0;
	this.pos   = 0; // cursor

	this.data = {};
	this.pointer = this.data;
}

Lex.prototype.descend = function(path) {
	var node = this.data;
	var self = this;
	path.split('.').forEach(function(p) {
		if (!(p in node)) {
			node[p] = {};
		}
		node = node[p];
		self.pointer = node;
	});
	// this.pointer = this.data[name] = {};
};

Lex.prototype.emit = function(name, value) {
	this.pointer[name] = value;
};

Lex.prototype.readUntil = function(x) {
	while (this.array[this.pos] !== x) {
		this.pos++;
	}

	var slice = this.array.subarray(this.start, this.pos);
	this.pos++;
	this.start = this.pos;
	return slice;
};

Lex.prototype.readLine = function() {
	return this.readUntil(0);
};

Lex.prototype.readLineString = function() {
	return shortArrayToString(this.readLine());
};

Lex.prototype.readByte = function() {
	var slice = this.array[this.pos++];
	this.start = this.pos;
	return slice;
};

Lex.prototype.readShort = function() {
	var num = this.readBytes(2);
	return num[0] + num[1] * 256;
};

Lex.prototype.readBytes = function(k) {
	this.pos += k;
	var slice = this.array.subarray(this.start, this.pos);
	this.start = this.pos;
	return slice;
};

Lex.prototype.skip = function(k) {
	this.pos += k || 1;
	this.start = this.pos;
};