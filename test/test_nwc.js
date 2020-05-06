var nwc = require('../src/nwc');
var fs = require('fs');
var assert = require('assert');

var files = [
    // 1.5
    'jem001.nwc',

    // 1.7
    'anongs.nwc',
    'adohn.nwc',
    'bwv140-2.nwc',
    'carenot.nwc',
    
    // 2.75
    'AveMariaArcadelt.nwc',
    'WeThreeKingsOfOrientAre.nwc',
];

var tests = {
    'jem001.nwc': {
        version: 1.55,
    },
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
    console.log('Processing file', file)
    var contents = fs.readFileSync(`samples/${file}`);
    var nwcdata = nwc.decodeNwcArrayBuffer(contents);

    var expected = tests[file];
    if (expected) {
        if ('version' in expected) equal(nwcdata.header.version, expected.version, 'decodes version number');
        if ('staves' in expected) equal(nwcdata.score.staves.length, expected.staves, `staves`);
        if ('firstTokens' in expected) equal(nwcdata.score.staves[0].tokens.length, expected.firstTokens, `first stave token`);
    }

    return assert(!!nwcdata, 'parsed');
});

function notEqual(any, expected, message) {
    message = `${message || ''} - ${any} should not equal ${ expected }`;
    assert.notEqual(any, expected, message);
}

function equal(any, expected, message) {
    message = `${message || ''} - ${any} should equal ${ expected }`;
    assert.equal(any, expected, message);
}
