var dox = require('./');

dox.extractDoc('./template.js', {row: false}, function(err, data) {
	console.log(JSON.stringify(data));
});