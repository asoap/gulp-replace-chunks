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

function runChained(plugins, contents, filePath) {
  return new Promise(function(resolve, reject) {
    var file = makeFile(contents, filePath);
    // pipe through each plugin sequentially
    var i = 0;
    function next(f) {
      if (i >= plugins.length) {
        resolve(String(f.contents));
        return;
      }
      var stream = plugins[i++];
      stream.on('data', function(output) { next(output); });
      stream.on('error', reject);
      stream.write(f);
    }
    next(file);
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

  it('should replace multiple chunks in one file', function() {
    var input = '<!-- rc|src:source.html -->first<!-- endrc -->\n<!-- rc|src:source.html -->second<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      var parts = result.split('\n');
      var helloCount = (result.match(/Hello World/g) || []).length;
      assert.strictEqual(helloCount, 2, 'should replace both chunks');
      assert(!result.includes('first'), 'should not contain first original text');
      assert(!result.includes('second'), 'should not contain second original text');
    });
  });

  it('should handle inline chunks preserving surrounding content', function() {
    var input = '<div><!-- rc|src:resource.html#header -->old<!-- endrc --></div>';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert(result.startsWith('<div>'), 'should preserve leading div');
      assert(result.endsWith('</div>'), 'should preserve trailing div');
      assert(result.includes('Header Content'), 'should contain header resource');
      assert(!result.includes('old'), 'should not contain original text');
    });
  });

  it('should handle tags with and without spaces', function() {
    var noSpaces = '<!--rc|src:source.html-->old<!--endrc-->';
    var withSpaces = '<!-- rc|src:source.html -->old<!-- endrc -->';
    return Promise.all([
      run(rc.replace_chunks(), noSpaces),
      run(rc.replace_chunks(), withSpaces)
    ]).then(function(results) {
      assert(results[0].includes('Hello World'), 'no-space tags should be replaced');
      assert(results[1].includes('Hello World'), 'spaced tags should be replaced');
    });
  });

  it('should accumulate content with chained pipes using append and remove_tags false', function() {
    var input = '<!-- rc|name:bottom -->\nInitial\n<!-- endrc -->';
    return runChained([
      rc.replace_chunks({
        name: 'bottom',
        new_text: 'Appended1\n',
        action: 'append',
        remove_tags: false
      }),
      rc.replace_chunks({
        name: 'bottom',
        new_text: 'Appended2\n',
        action: 'append',
        remove_tags: false
      })
    ], input).then(function(result) {
      assert(result.includes('Initial'), 'should keep initial text');
      assert(result.includes('Appended1'), 'should have first appended text');
      assert(result.includes('Appended2'), 'should have second appended text');
      assert(result.includes('<!-- rc|name:bottom -->'), 'should still have start tag');
      assert(result.includes('<!-- endrc -->'), 'should still have end tag');
    });
  });

  it('should override src from gulpfile params', function() {
    var input = '<!-- rc|src:nonexistent.html -->old<!-- endrc -->';
    return run(rc.replace_chunks({ src: 'source.html' }), input).then(function(result) {
      assert(result.includes('Hello World'), 'should use overridden src');
    });
  });

  it('should override action from gulpfile params', function() {
    var input = '<!-- rc|src:source.html|action:replace -->original<!-- endrc -->';
    return run(rc.replace_chunks({ action: 'append' }), input).then(function(result) {
      assert(result.includes('original'), 'should keep original (append mode)');
      assert(result.includes('Hello World'), 'should also have new content');
      assert.strictEqual(result, 'original<div class="injected">Hello World</div>\n');
    });
  });

  it('should use default replace_text when callback returns undefined', function() {
    var input = '<!-- rc|src:source.html -->old<!-- endrc -->';
    return run(rc.replace_chunks({
      callback: function(commands, data) {
        // returning nothing (undefined)
      }
    }), input).then(function(result) {
      assert(result.includes('Hello World'), 'should use default replace_text when callback returns undefined');
      assert(!result.includes('old'), 'should not contain original text');
    });
  });

  it('should remove custom tags with rc_remove_tags leaving other tags intact', function() {
    var input = 'before||-some tag-||after<!-- keep me -->';
    return run(rc.rc_remove_tags({ tags: { start: '||-', end: '-||' } }), input).then(function(result) {
      assert.strictEqual(result, 'beforeafter<!-- keep me -->');
    });
  });

  it('should suppress verbose output for chunks with verbose:false', function() {
    var input = '<!-- rc|src:source.html|verbose:false -->old content<!-- endrc -->';
    return run(rc.replace_chunks({ verbose: true }), input).then(function(result) {
      assert(result.includes('Hello World'), 'should still replace content when verbose:false');
      assert(!result.includes('old content'), 'should remove original text');
    });
  });

  it('should handle nested chunk replacement (source containing chunks)', function() {
    var input = '<!-- rc|src:nested_source.html -->\n<!-- endrc -->';
    return run(rc.replace_chunks(), input).then(function(result) {
      assert(result.includes('<span>Inner Content</span>'), 'should resolve inner chunk');
      assert(result.includes('<div class="outer">'), 'should contain outer wrapper');
    });
  });

  it('should replace chunk with no src using new_text param', function() {
    var input = '<!-- rc|name:footer -->old content<!-- endrc -->';
    return run(rc.replace_chunks({ name: 'footer', new_text: 'NEW FOOTER' }), input).then(function(result) {
      assert.strictEqual(result, 'NEW FOOTER');
    });
  });

});
