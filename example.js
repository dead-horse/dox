var dox = require('./');
//提取`template.js`的文档，如果第二个参数中的raw为true，则不对文档中的`description`做处理，否则会插入html标签。
dox.extractDoc('./template.js', {raw: true}, function(err, data) {
	console.log(JSON.stringify(data));
});