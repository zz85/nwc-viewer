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
	var firstBytes = smallArrayToString(byteArray.subarray(0, 5));
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

function smallArrayToString(array) {
	return String.fromCharCode.apply(null, array);
}

function process(array) {
	b = array;


	var lex = new Lex(array);

	Header(lex);
	Info(lex);

	PageSetup(lex);
	findNoOfStaff(lex);
}

function Header(lex) {
	var company = smallArrayToString(lex.readLine());
	var skip = smallArrayToString(lex.readLine());
	skip = smallArrayToString(lex.readLine());
	var product = smallArrayToString(lex.readLine());

	v = lex.readLine();
	lex.skip(2);
	console.log('name1', smallArrayToString(lex.readLine()))
	console.log('name2', smallArrayToString(lex.readLine()))
	lex.skip(8);
	lex.skip(2);

	var version_minor = v[0];
	var version_major = v[1];
	version = version_major + version_minor * 0.01;

	console.log(company, product, version);
}

function Info(lex) {
	title = smallArrayToString(lex.readLine());
	author = smallArrayToString(lex.readLine());
	copyright1 = smallArrayToString(lex.readLine());
	copyright2 = smallArrayToString(lex.readLine());
	if (version >= 2) {
		something = smallArrayToString(lex.readLine());
	}
	comments = smallArrayToString(lex.readLine());
	console.log(title,
			author, copyright1, copyright2, comments)
}

function PageSetup(lex) {
	margins = getMargins(lex)
	staffSize = getFonts(lex)
}

function getMargins(lex) {
	lex.skip(9);
	measureStart = lex.readByte();
	console.log('measureStart', measureStart);
	lex.skip(1); // likely 0
	margins = lex.readLine();
	console.log('margins', smallArrayToString(margins));
}

function getFonts(lex) {
	lex.skip(36);
	// staff font size
	staff = lex.readByte();
	lex.skip(1);

	console.log('Staff size: ', staff);
	for (var i = 0; i < 12; i++) {
		font = lex.readLine();
		style = lex.readByte();
		size = lex.readByte();

		console.log('font', smallArrayToString(font), style, size);;

		lex.skip(1);
		typeface = lex.readByte();
	}
}

function findNoOfStaff(lex) {
	dump(lex.array, lex.start);
	lex.readUntil(255);

	lex.readBytes(2)
	layering = lex.readByte(1)
	noOfStaffs = lex.readByte(1)
	lex.skip(1)
	console.log('noOfStaffs', noOfStaffs, layering);

}



function Lex(array) {
	this.array = array;
	this.start = 0;
	this.pos   = 0; // cursor
}

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
}

function LexLine(l) {

}
