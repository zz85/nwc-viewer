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

function process(array) {
	b = array;


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
	margins = Margins(lex)
	staffSize = Fonts(lex)
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
		style = lex.readByte();
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
	// dump(lex.array, lex.start);
	lex.readUntil(255);

	lex.readBytes(2)
	lex.emit('layering', lex.readByte(1));
	lex.emit('staves', lex.readByte(1));
	lex.skip(1)
}



function Lex(array) {
	this.array = array;
	this.start = 0;
	this.pos   = 0; // cursor

	this.data = {};
	this.pointer = this.data;
}

Lex.prototype.descend = function(name) {
	this.pointer = this.data[name] = {};
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

Lex.prototype.readBytes = function(k) {
	this.pos += k;
	var slice = this.array.subarray(this.start, this.pos);
	this.start = this.pos;
	return slice;
};

Lex.prototype.skip = function(k) {
	this.pos += k;
	this.start = this.pos;
};