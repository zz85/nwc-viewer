var nwc = require('../src/nwc');
var fs = require('fs');
var assert = require('assert');

var files = [
    'anongs.nwc',
    'adohn.nwc',
];

var tests = {
    'anongs.nwc': {
        version: 1.75,
        staves: 6,
        firstTokens: 167
    },
    'adohn.nwc': {
        version: 1.75,
        staves: 4,
        firstTokens: 232
    }
};


files.forEach(file => {
    var contents = fs.readFileSync(`../samples/${file}`);
    var nwcdata = nwc.decodeNwcArrayBuffer(contents);

    var test = tests[file];

    notEqual(nwcdata, null, 'returns nwcdata');
    equal(nwcdata.header.version, test.version, 'decodes version number');
    equal(nwcdata.score.staves.length, test.staves, `staves`);

    equal(nwcdata.score.staves[0].tokens.length, test.firstTokens, `first stave token`);
});

function notEqual(any, expected, message) {
    message = `${message || ''} - ${any} should not equal ${ expected }`;
    assert.notEqual(any, expected, message);
}

function equal(any, expected, message) {
    message = `${message || ''} - ${any} should equal ${ expected }`;
    assert.equal(any, expected, message);
}
