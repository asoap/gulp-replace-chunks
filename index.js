var fs          = require('fs'),
    path        = require('path'),
    es          = require('event-stream'),
    PluginError = require('plugin-error'),
    clr         = require('ansi-colors');



// reference on creating a node module
// https://www.digitalocean.com/community/tutorials/how-to-create-a-node-js-module

// reference to publish to npm
// https://zellwk.com/blog/publish-to-npm/

function removeRelativePathPrefix(filePath) {
  // replace ./ with nothing
  return filePath.replace(/^\.\//, '');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  // https://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex
}

function do_error(error_text) {
  throw new PluginError('gulp-replace-chunks', error_text);
}


function rc_remove_tags(input_params) {
  // This is to remove the <!-- --> tags from the file. For example if you had a set of tags under a different name that is only
  // replaced if a condition is met.  Then
  function do_output(out_string) {
    if (params.verbose) {
      console.log(out_string);
    }
  }

  var default_params = {
    tags: {
      start :   '<!--',
      end :     '-->'
    },
    verbose: false
  }
  var params = Object.assign({}, default_params, input_params);   // combine the default and input params into a single object.
  params.tags.start = escapeRegExp(params.tags.start);
  params.tags.end   = escapeRegExp(params.tags.end);

  do_output('--------------------------------');
  do_output('PARAMS:');
  do_output(params);

  function remove_rc_tags(content) {
    // <!--[\s\S]*?-->(\\r\\n|\\r|\\n)?
    var regex   = new RegExp(params.tags.start + "[\\s\\S]*?" + params.tags.end + "(\\r\\n|\\r|\\n)?", "mg")
    var matches = content.match(regex);
    do_output('--------------------------------');
    do_output('WHAT WILL BE REMOVED:');
    for (var x in matches) {
      do_output(clr.yellow(matches[x]));
    }

    return content.replace(regex, "");
  }

  function main_loop(file, callback) {

    if (file.isNull()) {
        return callback(null, file);
    }

    if (file.isStream()) {
        do_error();
        //throw new PluginError('gulp-replace-in-place', 'stream not supported');
    }

    if (file.isBuffer()) {
      var new_content = remove_rc_tags(String(file.contents));
      file.contents = Buffer.from(new_content);
      do_output('--------------------------------');
    }

    callback(null, file);
  }

  return es.map(main_loop)
}


function replace_chunks(input_params) {

  function do_output(out_string) {
    if (params.verbose) {
      console.log(out_string);
    }
  }

  var default_params = {
    name: 'default',
    remove_tags : true,
    tags: {
      start :   '<!--',
      end :     '-->'
    },
    callback: undefined,
    verbose: false,
    new_text: undefined,
    action: undefined,
    src: undefined
    /*
    tags: {
      start :   '||-',
      end :     '-||'
    }
    */

  }
  var params = Object.assign({}, default_params, input_params);   // combine the default and input params into a single object.
  params.tags.start = escapeRegExp(params.tags.start);
  params.tags.end   = escapeRegExp(params.tags.end);




  do_output('--------------------------------');
  do_output('PARAMS:');
  do_output(params);

  function remove_rc_tags(content) {
    return content.replace(new RegExp(params.tags.start + "[\\s\\S]*?" + params.tags.end + "(\\r\\n|\\r|\\n)?", "mg"), "");;
  }

  function get_source_contents(base_path, input_path) {

    var load_path   = input_path;
    var resource_id = undefined;  // if defined then we're looking for a specific resource.
    if (input_path.includes('#')) {
      var path_split  = input_path.split('#');
      load_path       = path_split[0];
      resource_id     = path_split[1];
    }

    var file_path = base_path + "\\" + removeRelativePathPrefix(load_path);
    try {
      var new_content = String(fs.readFileSync(file_path));
    } catch (err) {
      do_error(err);
    }

    if (!resource_id) {
      return new_content;
    }
    // we have a resource_id. So we need to find that in the conent.
    var regex_pattern = params.tags.start + "\\s?rc\\|resource:" + resource_id +  "\\s?" + params.tags.end + "[\\s\\S]*?" + params.tags.start + "\\s?endrc\\s?" + params.tags.end + "(\\r\\n|\\r|\\n)?";
    // we take the first match here. Maybe we might want to modify it later on.  But this should be fine
    var match         = new_content.match(new RegExp(regex_pattern, "mg"));
    if (match && match.length > 0) {
      return remove_rc_tags(match[0]);
    } else {
      do_error('Unable to find the resource: ' + resource_id + ' in file: ' + file_path);
    }
  }

  function process_file(content, input_path) {
    var relative_base_path = path.dirname(input_path);

    do_output('--------------------------------');
    do_output('WORKING ON FILE:');
    do_output(clr.yellow(input_path));

    // find the start tag, content, and end tag.
    // <!--\s?rc(\w|:|\||\.|#|\\|\/)*\s?-->[\s\S]*?<!--\s?endrc\s?-->(\\r\\n|\\r|\\n)?
    var regex_pattern = params.tags.start + "\\s?rc(\\w|:|\\||\\.|#|\\\\|/)*\\s?" + params.tags.end + "[\\s\\S]*?" + params.tags.start + "\\s?endrc\\s?" + params.tags.end + "(\\r\\n|\\r|\\n)?";
    var regex         = new RegExp(regex_pattern, "mg");
    var matches       = content.match(regex);

    for (var x in matches) {
      var match = matches[x];

      // cut up the matching block into a command line, end line, and the original text.
      // Note: "(\\r\\n|\\r|\\n)?" is for matching to the end of a line for windows, mac, linux.
      // The regex is a bit nasty but it's been tested pretty hard. Having the whole block on a single line, mulitpe lines, space between start/end tags, etc.
      // <!--\s?rc(\w|:|\||\.|#)*\s?-->(\r\n|\r|\n)? // the regex for finding the command line
      //            ^^^^^^^^^^^^^ - looking for command type characters, such as: / \ . | : # letters numbers.  This was important as before it was lookign for any character .* which caused errors.
      var command_line    = match.match(new RegExp( params.tags.start + "\\s?rc(\\w|:|\\||\\.|#|\\\\|/)*\\s?" + params.tags.end + "(\\r\\n|\\r|\\n)?", "mg"))[0];
      var end_line        = match.match(new RegExp( params.tags.start + "\\s?endrc\\s?" + params.tags.end + "(\\r\\n|\\r|\\n)?", "mg"))[0];
      var input_commands  = command_line.replace(new RegExp( params.tags.start + "\\s?", "mg"), "");      // replace <!-- with ''
      input_commands      = input_commands.replace(new RegExp( "\\s?" + params.tags.end + "(\\r\\n|\\r|\\n)?" , "mg"), "");        // replace --> with ''
      input_commands      = input_commands.split('|');  // start breaking down the commands.
      var original_text   = match.replace(command_line, '');
      original_text       = original_text.replace(end_line, '');

      //console.log('match: ');
      //console.log(match);
      //console.log('original text: ');
      //console.log(original_text);
      //console.log('command line: ');
      //console.log(command_line);
      //console.log('end line: ');
      //console.log(end_line);

      // split the commands on the colon. 'src:bits.html' becomes {src: 'bits.html'}
      var commands = {};
      for (var y in input_commands) {
        var commands_split = input_commands[y].split(':');
        if (commands_split.length == 2) {
          commands[commands_split[0]] = commands_split[1];
        }
      }
      // add in important defaults if they don't exist
      if (!('name' in commands))    { commands['name']    = 'default';      }   // if no name key found, add in the default which is name = "default"
      if (!('action' in commands))  { commands['action']  = 'replace';      }   // if no action key found, add in the default which is action = "replace"
      if (params.action)            { commands['action']  =  params.action  }   // if the gulpfile has an action, we use that to overwride the actions.
      if (params.src)               { commands['src']     =  params.src  }      // if the gulpfile has provided a source we use that to overwite the inline one.



      //if ((params.name.toLowerCase() == commands.name.toLowerCase()) && commands.src ) {
      if ((params.name.toLowerCase() == commands.name.toLowerCase()) ) {
        // we have found one that has the correct name and has a source
        var new_content = '';
        if (commands.src) {
          new_content = get_source_contents(relative_base_path, commands.src);
        }

        if (params.new_text) {
          // if in the gulpfile we have told it to replace specific text, then we use this.
          new_content = params.new_text;
        }


        // start building the replace text
        var replace_text = new_content;

        if (commands.action === 'replace') {
          replace_text = new_content;
        } else if(commands.action === 'append') {
          replace_text = original_text + new_content;
        } else if(commands.action === 'prepend') {
          replace_text = new_content + original_text;
        }

        // if remove_tags is false then we add the start/end tags back in.
        if (!params.remove_tags) {
          replace_text = command_line + replace_text + end_line;
        }

        // if there is a call back, let's call it. Then check what it returns.  If it returns something
        // then we will replace the match with it.
        if (typeof params.callback === 'function') {
          //console.log(typeof params.callback);
          var return_from_callback = params.callback(commands, {
            command_line  : command_line,       // the first line which starts the replace and includes commands
            end_line      : end_line,           // the tags that show the end of the replace
            original_text : original_text,      // what was originally in between start/end tags
            new_text      : new_content,        // the text we've loaded in from a source
            replace_text  : replace_text        // what we intend to replace it with
          });
          if (return_from_callback) {
            replace_text = return_from_callback;
          }
        }
        // replace the original match with the new one we created.
        //console.log(match);
        do_output('--------------------------------');
        do_output('Found this: ');
        do_output(clr.cyan(match));
        do_output('Replacing with: ');
        do_output(clr.yellow(replace_text));

        content = content.replace(match, replace_text);
      }

    }

    return content;
  }

  function main_loop(file, callback) {

    if (file.isNull()) {
        return callback(null, file);
    }

    if (file.isStream()) {
        do_error();
        //throw new PluginError('gulp-replace-in-place', 'stream not supported');
    }

    if (file.isBuffer()) {
      var new_content = process_file(String(file.contents), file.path);
      file.contents = Buffer.from(new_content);
      do_output('--------------------------------');
    }

    callback(null, file);
  }

  return es.map(main_loop)
}

module.exports.replace_chunks   = replace_chunks;
module.exports.rc_remove_tags   = rc_remove_tags;
