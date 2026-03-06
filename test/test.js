var assert = require('assert');
var path = require('path');
var File = require('vinyl');
var rc = require('../index');

var fixturesDir = path.join(__dirname, 'fixtures');

function makeFile(contents, filePath) {
  return new File({
    path: filePath || path.join(fixturesDir, 'test.html'),
    contents: Buffer.from(contents)
  });
}

function run(plugin, contents, filePath) {
  return new Promise(function(resolve, reject) {
    var file = makeFile(contents, filePath);
    var stream = plugin;
    stream.on('data', function(output) {
      resolve(String(output.contents));
    });
    stream.on('error', reject);
    stream.write(file);
  });
}

describe('replace_chunks', function() {

  it('should replace content from a source file', function() {
    var input = '<!-- rc|src:source.html -->old content<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert.strictEqual(result, '<div class="injected">Hello World</div>\n');
    });
  });

  it('should handle $& and other special replacement patterns literally', function() {
    var input = '<!-- rc|src:specialchars.js -->old content<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert(result.includes('\\\\$&'), 'should contain literal $&');
      assert(result.includes('$`'), 'should contain literal $`');
      assert(result.includes("$'"), "should contain literal $'");
      assert(result.includes('$$'), 'should contain literal $$');
    });
  });

  it('should append original text before new content with action:append', function() {
    var input = '<!-- rc|src:source.html|action:append -->original<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert.strictEqual(result, 'original<div class="injected">Hello World</div>\n');
    });
  });

  it('should prepend new content before original text with action:prepend', function() {
    var input = '<!-- rc|src:source.html|action:prepend -->original<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert.strictEqual(result, '<div class="injected">Hello World</div>\noriginal');
    });
  });

  it('should support custom tags', function() {
    var input = '//-- rc|src:source.html --//old content//-- endrc --//';
    return run(rc.replace_chunks({ tags: { start: '//--', end: '--//' } }), input).then(function(result) {
      assert.strictEqual(result, '<div class="injected">Hello World</div>\n');
    });
  });

  it('should preserve tags when remove_tags is false', function() {
    var input = '<!-- rc|src:source.html -->old content<!-- endrc -->';
    return run(rc.replace_chunks({ remove_tags: false }), input).then(function(result) {
      assert(result.includes('<!-- rc|src:source.html -->'), 'should contain start tag');
      assert(result.includes('<!-- endrc -->'), 'should contain end tag');
      assert(result.includes('Hello World'), 'should contain replacement content');
    });
  });

  it('should only replace chunks matching the given name', function() {
    var input = '<!-- rc|src:source.html|name:header -->old<!-- endrc -->\n<!-- rc|src:source.html|name:footer -->keep<!-- endrc -->';
    return run(rc.replace_chunks({ name: 'header' }), input).then(function(result) {
      assert(result.includes('Hello World'), 'should replace named chunk');
      assert(result.includes('<!-- rc|src:source.html|name:footer -->'), 'should not replace other chunks');
    });
  });

  it('should strip tags with rc_remove_tags', function() {
    var input = 'before<!-- some tag -->after';
    return run(rc.rc_remove_tags(), input).then(function(result) {
      assert.strictEqual(result, 'beforeafter');
    });
  });

  it('should extract a specific resource by ID using #', function() {
    var input = '<!-- rc|src:resource.html#header -->old<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert(result.includes('Header Content'), 'should contain header resource');
      assert(!result.includes('Footer Content'), 'should not contain footer resource');
    });
  });

  it('should use new_text parameter instead of source file', function() {
    var input = '<!-- rc|src:source.html -->old<!-- endrc -->';
    return run(rc.replace_chunks({ new_text: 'OVERRIDE' }), input).then(function(result) {
      assert.strictEqual(result, 'OVERRIDE');
    });
  });

  it('should call callback with correct data and allow override', function() {
    var input = '<!-- rc|src:source.html -->old<!-- endrc -->';
    var callbackData = null;
    return run(rc.replace_chunks({
      callback: function(commands, data) {
        callbackData = data;
        return 'CALLBACK_RESULT';
      }
    }), input).then(function(result) {
      assert.strictEqual(result, 'CALLBACK_RESULT');
      assert.strictEqual(callbackData.original_text, 'old');
      assert(callbackData.new_text.includes('Hello World'), 'new_text should contain source content');
      assert(callbackData.command_line.includes('rc|src:source.html'), 'command_line should contain source');
    });
  });

});
