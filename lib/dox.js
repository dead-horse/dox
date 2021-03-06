
/*!
 * Module dependencies.
 */

var fs = require('fs')
  , pathModule = require('path')
  , markdown = require('github-flavored-markdown').parse
  , escape = require('./utils').escape;

/**
 * Library version.
 */

exports.version = require('../package.json').version;
/**
 * Parse comments in the given string of `js`.
 *
 * @param {String} js
 * @param {Object} options
 * @return {Array}
 * @see exports.parseComment
 * @api public
 */

exports.parseComments = function(js, options){
  options = options || {};
  js = js.replace(/\r\n/gm, '\n');
  var comments = []
    , raw = options.raw
    , comment
    , buf = ''
    , ignore
    , withinMultiline = false
    , withinSingle = false
    , code;

  for (var i = 0, len = js.length; i < len; ++i) {
    // start comment
    if (!withinMultiline && !withinSingle && '/' == js[i] && '*' == js[i+1]) {
      // code following previous comment
      if (buf.trim().length) {
        comment = comments[comments.length - 1];
        if(comment) {
          comment.code = code = buf.trim();
          comment.ctx = exports.parseCodeContext(code);
        }
        buf = '';
      }
      i += 2;
      withinMultiline = true;
      ignore = '!' == js[i];
    // end comment
    } else if (withinMultiline && !withinSingle && '*' == js[i] && '/' == js[i+1]) {
      i += 2;
      buf = buf.replace(/^ *\* ?/gm, '');
      var comment = exports.parseComment(buf, options);
      comment.ignore = ignore;
      comments.push(comment);
      withinMultiline = ignore = false;
      buf = '';
    } else if (!withinSingle && !withinMultiline && '/' == js[i] && '/' == js[i+1]) {
      withinSingle = true;
      buf += js[i];
    } else if (withinSingle && !withinMultiline && '\n' == js[i]) {
      withinSingle = false;
      buf += js[i];
    // buffer comment or code
    } else {
      buf += js[i];
    }
  }

  if (comments.length === 0) {
    comments.push({
      tags: [],
      description: {full: '', summary: '', body: ''},
      isPrivate: false
    });
  }

  // trailing code
  if (buf.trim().length) {
    comment = comments[comments.length - 1];
    code = buf.trim();
    comment.code = code;
    comment.ctx = exports.parseCodeContext(code);
  }

  return comments;
};

/**
 * Parse the given comment `str`.
 *
 * The comment object returned contains the following
 *
 *  - `tags`  array of tag objects
 *  - `description` the first line of the comment
 *  - `body` lines following the description
 *  - `content` both the description and the body
 *  - `isPrivate` true when "@api private" is used
 *
 * @param {String} str
 * @param {Object} options
 * @return {Object}
 * @see exports.parseTag
 * @api public
 */

exports.parseComment = function(str, options) {
  str = str.trim();
  options = options || {};

  var comment = { tags: [] }
    , raw = options.raw
    , mul = options.multiLine
    , depth = options.depth
    , path = options.path
    , description = {};

  // parse comment body
  //if no comment description
  if (str[0] === '@') {
    description = {
      full: '',
      summary: '',
      body: ''
    }
  } else {
    description.full = str.split('\n@')[0];
    description.summary = description.full.split('\n\n')[0];
    description.body = description.full.split('\n\n').slice(1).join('\n\n');
  }
  comment.description = description;

  // parse tags
  if (~str.indexOf('\n@')) {
    if (str[0] === '@') {
      str = '\n' + str;
    }
    var tags = '@' + str.split('\n@').slice(1).join('\n@');
    comment.tags = tags.split(mul ? '\n@' : '\n').map(exports.parseTag, {
      raw: raw,
      path: path,
      depth: depth,
      multiLine: mul
    });
    comment.isPrivate = comment.tags.some(function(tag){
      return 'api' == tag.type && 'private' == tag.visibility;
    })
  }

  // markdown
  if (!raw) {
    description.full = markdown(description.full);
    description.summary = markdown(description.summary);
    description.body = markdown(description.body);
  }

  return comment;
}

/**
 * Parse tag string "@param {Array} name description" etc.
 *
 * @param {String}
 * @param {Boolean}
 * @return {Object}
 * @api public
 */

exports.parseTag = function(str) {
  var tag = {} 
    , raw = this.raw
    , mul = str.indexOf('\n')
    , extendTags = this.extendTags || []
    , parts = str.slice(0, mul < 0 ? undefined : mul).split(/ +/)
    , type = tag.type = parts.shift().replace('@', '')
    , left = mul < 0 ? '' : str.slice(mul);

  switch (type) {
    case 'param':
      tag.types = exports.parseTagTypes(parts.shift());
      tag.name = parts.shift() || '';
      tag.description = parts.join(' ') + left;
      if (!raw) {
        tag.description = markdown(tag.description);
      }
      break;
    case 'return':
      tag.types = exports.parseTagTypes(parts.shift());
      tag.description = parts.join(' ') + left;
      if (!raw) {
        tag.description = markdown(tag.description);
      }
      break;
    case 'see':
      if (~str.indexOf('http')) {
        tag.title = parts.length > 1
          ? parts.shift()
          : '';
        tag.url = parts.join(' ');
      } else {
        tag.local = parts.join(' ');
      }
    case 'api':
      tag.visibility = parts.shift();
      break;
    case 'type':
      tag.types = exports.parseTagTypes(parts.shift());
      break;
    case 'memberOf':
      tag.parent = parts.shift();
      break;
    case 'augments':
      tag.otherClass = parts.shift();
      break;
    case 'borrows':
      tag.otherMemberName = parts.join(' ').split(' as ')[0];
      tag.thisMemberName = parts.join(' ').split(' as ')[1];
      break;
    case 'detail': 
    var detailPath = pathModule.join(pathModule.dirname(this.path), parts.shift());
    var depth = this.depth;
    if (depth && depth > 0) {
      tag.detail = exports.extractDocSync(detailPath, {
        raw: this.raw,
        multiLine: this.multiLine,
        depth: depth - 1
      });
    } else {
      tag.detail = detailPath;
    }
    break;
    default:
      tag.string = parts.join(' ');
      break;
  }

  return tag;
}

/**
 * Parse tag type string "{Array|Object}" etc.
 *
 * @param {String} str
 * @return {Array}
 * @api public
 */

exports.parseTagTypes = function(str) {
  return str
    .replace(/[{}]/g, '')
    .split(/ *[|,\/] */);
};

/**
 * Parse the context from the given `str` of js.
 *
 * This method attempts to discover the context
 * for the comment based on it's code. Currently
 * supports:
 *
 *   - function statements
 *   - function expressions
 *   - prototype methods
 *   - prototype properties
 *   - methods
 *   - properties
 *   - declarations
 *
 * @param {String} str
 * @return {Object}
 * @api public
 */

exports.parseCodeContext = function(str){
  var str = str.split('\n')[0];

  // function statement
  if (/^function (\w+) *\(/.exec(str)) {
    return {
        type: 'function'
      , name: RegExp.$1
      , string: RegExp.$1 + '()'
    };
  // function expression
  } else if (/^var *(\w+) *= *function/.exec(str)) {
    return {
        type: 'function'
      , name: RegExp.$1
      , string: RegExp.$1 + '()'
    };
  // prototype method
  } else if (/^(\w+)\.prototype\.(\w+) *= *function/.exec(str)) {
    return {
        type: 'method'
      , constructor: RegExp.$1
      , name: RegExp.$2
      , string: RegExp.$1 + '.prototype.' + RegExp.$2 + '()'
    };
  // prototype property
  } else if (/^(\w+)\.prototype\.(\w+) *= *([^\n;]+)/.exec(str)) {
    return {
        type: 'property'
      , constructor: RegExp.$1
      , name: RegExp.$2
      , value: RegExp.$3
      , string: RegExp.$1 + '.prototype' + RegExp.$2
    };
  // method
  } else if (/^(\w+)\.(\w+) *= *function/.exec(str)) {
    return {
        type: 'method'
      , receiver: RegExp.$1
      , name: RegExp.$2
      , string: RegExp.$1 + '.' + RegExp.$2 + '()'
    };
  // property
  } else if (/^(\w+)\.(\w+) *= *([^\n;]+)/.exec(str)) {
    return {
        type: 'property'
      , receiver: RegExp.$1
      , name: RegExp.$2
      , value: RegExp.$3
      , string: RegExp.$1 + '.' + RegExp.$2
    };
  // declaration
  } else if (/^var +(\w+) *= *([^\n;]+)/.exec(str)) {
    return {
        type: 'declaration'
      , name: RegExp.$1
      , value: RegExp.$2
      , string: RegExp.$1
    };
  }
};

/**
 * extract document
 *
 * @param {String} path the file's path which want to extract the document
 * @param {Object} options
 *   - {Boolean} raw  true不解析markdown
 *   - {Boolean} multiLine true允许@param中多行
 *   - {Number} depth 设置detail递归层数，默认不递归执行
 * @api public
 */
exports.extractDoc = function(path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  } else {
    options.path = path;
  }
  fs.readFile(path, 'utf8', function(err, data) {
    if (err) {
      return callback(err);
    }
    return callback(err, exports.parseComments(data, options));
  });
}

exports.extractDocSync = function(path, options) {
  var data = fs.readFileSync(path, 'utf8');
  if (!options) { 
    options = {path: path};
  } else {
    options.path = path;
  }
  return exports.parseComments(data, options);
}