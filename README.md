# gulp-replace-chunks

## NOTE: Still an early development version.  I have now used it in a project and so far it's doing it's job nicely.

> A plugin for [gulp](https://github.com/wearefractal/gulp). This lets you replace chunks of code using block/comment tags.  You configure the source and how it will replace in the block.  



## Introduction

`gulp-replace-chunks` In it's simplest form you can replace text in between <!-- --> tags.  It is also configured in the block so you can say where it's replaced from.  I built this because I wanted the same code added to multiple files.  Also I wanted different processes to be able to add to each of these chunks.  


## Installation

Install `gulp-replace-chunks` as a development dependency:

```shell
npm install --save-dev gulp-replace-chunks
```

## Basic usage

**The target file `src/index.html`:**


```html
<!DOCTYPE html>
<html>
<head>
  <title>My index</title>
</head>
<body>
  <!-- rc|src:stuff.html -->
  <h1>This is a h1 header</h1>
  <!-- endrc -->

  <!-- rc|src:stuff.html -->
  <h2>This is a h2 header</h2>
  <!-- endrc -->
</body>
</html>
```

**The source file `src/stuff.html`: (note: paths are relative to the target file)**

```html
  <div>No more headers</div>
```


**The `gulpfile.js`:**

```javascript
const { src, dest }                             = require('gulp');
const { replace_chunks, rc_remove_tags }     = require('gulp-replace-chunks');

function example() {
  return src('src/index.html')
    .pipe(replace_chunks())
    .pipe(dest('build/'));
}

exports.example                              = example;
```

**`build/index.html` after running `gulp example`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My index</title>
</head>
<body>
  <div>No more headers</div>

  <div>No more headers</div>
</body>
</html>
```

## Example: Using a single file for multiple sources

Instead of having multiple files clogging up your folder you can put code into a single file

**Project structure:**

**The target file `src/index.html`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My index</title>
</head>
<body>
  <!--rc|src:bits.html#section_1 -->
  <p>Paragraph #1</p>
  <!-- endrc-->

  <div><!--rc|src:bits.html#section_2 --><h2>This is a h2 header</h2><!-- endrc --></div>
</body>
</html>
```

**The source file `src/bits.html`:**

```html
  <!-- rc|resource:section_1 -->
  <p><strong>THIS IS THE NEW PARAGRAPH 1! MUAHAHA!</strong></p>
  <!-- endrc -->

  <!-- rc|resource:section_2 -->
  <p><strong>I AM AMAZING!</strong></p>
  <!-- endrc -->
```

**The `gulpfile.js`: SAME AS ABOVE!**

**`build/index.html` after running `gulp example`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My index</title>
</head>
<body>
  <p><strong>THIS IS THE NEW PARAGRAPH 1! MUAHAHA!</strong></p>

  <div><p><strong>I AM AMAZING!</strong></p></div>

</body>
</html>
```





## Example: One tag two pipes

If you have an area where you want multiple processes to add content, you can use these settings.  For example you might want
to have a tag for the footer area where you can include javascript

**Project structure:**

**The target file `src/index.html`:**

```html
<!-- rc|name:index_bottom -->
This is the initial text
<!-- endrc -->
```

**The `gulpfile.js`**


```javascript
const { src, dest }                             = require('gulp');
const { replace_chunks, rc_remove_tags }        = require('gulp-replace-chunks');

function example() {
  return src('src/index.html')
    .pipe(replace_chunks({
      name:         'index_bottom',
      new_text:     'Appending #1 \n',      // you can add text by providing it
      action:       'append',
      remove_tags:  false
    }))
    .pipe(replace_chunks({
      name:         'index_bottom',
      src:          'bits.html#section_1',  // or you can just provide a link to a file. This file is from an above example
      action:       'append',
      remove_tags:  false
    }))
    .pipe(dest('build/'));
}

exports.example                              = example;
```

### NOTE: If you're using this option, I strongly consider using the name property.  If you leave the name out, it defaults to "default" and will execute on any non named chunks.

**`build/index.html` after running `gulp example`:**

```html
<!-- rc|name:index_bottom -->
This is the initial text
Appending #1
<p><strong>THIS IS THE NEW PARAGRAPH 1! MUAHAHA!</strong></p>
<!-- endrc -->
```





## Example: More options

**`src/index.html`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My index</title>
</head>
<body>
  <!--rc|name:default|src:bits.html#section_1|action:append -->
  <p>Paragraph #1</p>
  <!-- endrc-->

  ||-rc|src:bits.html#section_2 -||
  <p>Paragraph #2</p>
  ||-endrc-||

  <!-- rc|src:bits.html#section_whatever|action:prepend -->
  <p>Paragraph #3</p>
  <!--endrc-->

  <!--rc|name:client|src:bits.html#section_4-->
  <p>Paragraph #5</p>
  <!-- endrc -->

</body>
</html>
```

**The source file `src/bits.html`:**

```html
  <!-- rc|resource:section_1 -->
  <p><strong>THIS IS THE NEW PARAGRAPH 1! MUAHAHA!</strong></p>
  <!-- endrc -->

  <!-- rc|resource:section_2 -->
  <p><strong>I AM AMAZING!</strong></p>
  <!-- endrc -->

  <!-- rc|resource:section_whatever -->
  <p><strong>WHY AM I YELLING!?</strong></p>
  <!-- endrc -->

  <!-- rc|resource:section_4 -->
  <p>I think you get the idea</p>
  <!-- endrc -->
```

**The `gulpfile.js`: SAME AS ABOVE!**

**`build/index.html` after running `gulp example`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My index</title>
</head>
<body>
  <p>Paragraph #1</p>
  <p><strong>THIS IS THE NEW PARAGRAPH 1! MUAHAHA!</strong></p>

  ||-rc|src:bits.html#section_2 -||
  <p>Paragraph #2</p>
  ||-endrc-||

  <p><strong>WHY AM I YELLING!?</strong></p>
  <p>Paragraph #3</p>

  <p>Paragraph #5</p>

</body>
</html>
```
Let's break down some of these parameters.

## Tagline parameters

#### name
Parameter: `name`  
Type: `String`
Default: `default`

This is used if you want to have different processes replace different parts of code. You can remove the name parameter and
in the gulpfile.js it will still appear under 'default'

#### src
Parameter: `src`  
Type: `String`
Default: `Null`

Example: 'src:some_file.html' This is the file that you use to load in code.  As you can see in the example above '#string' added to the src let's you define a section of that file to get code from.  

#### action
Parameter: `action`  
Type: `String`
Default: `replace`

Possible values: 'replace', 'append', 'prepend'.  You can keep on adding more and more code to the end/beginning of a chunk.


## replace_chunks() parameters

```javascript
const { src, dest }                             = require('gulp');
const { replace_chunks, rc_remove_tags }     = require('gulp-replace-chunks');

function example() {  
  // These are the default parameters for replace_chunks()
  return src('src/index.html')
    .pipe(replace_chunks({
      name: 'default',
      remove_tags : true,
      callback: undefined,
      verbose: false,
      tags: {
        start :   '<!--',
        end :     '-->'
      },
      new_text: undefined,
      action: undefined,
      src: undefined
    }))
    .pipe(dest('build/'));
}

exports.example                              = example;
```

#### name
Parameter: `name`  
Type: `String`
Default: `default`

Used to identify which blocks to work on.  If no name is provided in the original code it assumes the name is 'default'

#### remove_tags
Parameter: `remove_tags`  
Type: `Boolean`
Default: `true`

If you want multiple processes to work on the same chunk then set remove_tags to false.  They will remain for the next process and can be identified again by the next one.

#### callback
Parameter: `callback`  
Type: `Function`
Default: `undefined`

Example:
```javascript
.pipe(replace_chunks({callback: function(commands,texts) {
  console.log('commands:');
  console.log(commands);
  console.log('texts:');
  console.log(texts);
  return "I like fish";
}}))
```
This allows you to change exactly what/how blocks are changed from your gulpfile.  Commands contains all of the items from the <!-- --> line.  For example:  <!--rc|name:default|src:bits.html#section_1|action:append -->

Texts, these include:
```javascript
{
  command_line: '<!-- rc|src:bits.html#section_whatever -->\r\n',
  end_line: '<!--endrc-->\r\n',
  original_text: '<p>Paragraph #3</p>\r\n',
  new_text: '<p><strong>WHY AM I YELLING!?</strong></p>\r\n',
  replace_text: '<p><strong>WHY AM I YELLING!?</strong></p>\r\n'
}
```
So the lines that start/end a chunk. What was originally in a chunk, what was loaded and what is going to replaced.
Now if you don't want any of this, just return the function with your new text.  For example: "I like fish"



#### verbose
Parameter: `verbose`  
Type: `Boolean`
Default: `false`

It will spit out a bunch of stuff to the console while you're running gulp tasks.  It's good if you're developing a gulpfile.


#### tags
Parameter: `tags`  
Type: `Object`
Default: `<!-- and -->`

Example:
```javascript
tags: {
  start :   '<!--',
  end :     '-->'
}
```
You can provide a new object if you want the start and end tags to be ||- and -||.  Or maybe //- and -//



#### new_text
Parameter: `new_text`  
Type: `String`
Default: `undefined`

This will overwrite whatever you have as source in your original file. This is good if you want to add text to a specific tag.

**WARNING:  If this parameter is used while executing on the default tag it will overwrite every default tag.**


#### src
Parameter: `src`  
Type: `String`
Default: `undefined`

This will overwrite whatever your initial text file has defined. This is good if you want to add text to a specific tag.

**WARNING:  If this parameter is used while executing on the default tag it will overwrite every default tag.**



#### action
Parameter: `action`  
Type: `String`
Default: `undefined`

This will overwrite whatever your initial text file has defined. This is good if you want to add text to a specific tag.

Possible values: 'replace', 'append', 'prepend'.  

**WARNING:  If this parameter is used while executing on the default tag it will overwrite every default tag.**


# rc_remove_tags()

Say you have completed all of your work on a file but there is still RC tags laying around and you want to remove them.  This is where rc_remove_tags() comes in.

Example:

```javascript
const { replace_chunks, rc_remove_tags }     = require('gulp-replace-chunks');
function lets_build() {
  return src('src/index.html')
    .pipe(replace_chunks())
    .pipe(rc_remove_tags({
      tags : {
        start : '||-',
        end :   '-||'
      }
    }))
    .pipe(rc_remove_tags())
    .pipe(dest('build/'));
}
```
The above example will execute replace_chunks(), then rc_remove_tags looks for ||- -|| tags which was used in an example above.  Finally we run rc_remove_tags() again without parameters which will remove any left over <!-- rc --> tags.
