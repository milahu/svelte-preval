# svelte-preval

compile time eval for svelte components

performant:  
eval static expressions at compile time  
allow shorter load times for client

readable:  
avoid "magic numbers"  
colocate "all the code" in one place

powerful:  
use any node package on compile time

license = public domain = CC0-1.0  
warranty = none

## install

```sh
npm i -D https://github.com/milahu/svelte-preval.git
```

### install dependencies

TODO better?

```sh
npm i -D tosource uglify-js
```

other peerDependencies are provided by svelte

## config

merge this with your `rollup.config.js`

```js
import sveltePreval from 'svelte-preval';

export default {
  plugins: [
    svelte({
      preprocess: [
        sveltePreval({
          //defaultOn: true,
          //funcName: 'preval',
          //scriptAttr: 'preval',
          //baseDir: __dirname, // directory of rollup.config.js = project root
          // here you can add more values
          // the whole options object is passed to the eval-ed function
        }),
      ],
    }),
  ],
};
```

## use sample

in your `App.svelte` add to your `<script>`

```js
// preval object
let testPrevalObj = preval(() => ({
  a: Math.PI * 0.5,
  b: Math.sqrt(2),
}));

// result
let testPrevalObj = {
  a: 1.5707963267948966,
  b: 1.4142135623730951
};
```

## config

### defaultOn

set to false  
to make preval "normally off"  
and only enable in  
```xml
<script preval>
or
<script preval="custom_preval_funcName">
```

### funcName

instead of `let x = preval(f)`  
you can use `let x = custom_preval_name(f)`

local - by changing your App.svelte to

```xml
  <script preval="local_preval_name">
    let x = local_preval_name(() => ('result'))
  </script>
```

global - by changing rollup.config.js to

```js
preprocess: [
  sveltePreval({
    funcName: 'custom_preval_name',
  }),
],
```

### scriptAttr

change the `<script>` attribute  
to activate preval like `<script preval>`  
or to change the funcName like `<script preval="myPreval">`

default is "preval", so `<script preval>`

## using modules

yes you can use modules inside the preval code  
but modules must be in commonJS format

so you can use

```js
let testPreval = preval(() => {
  const fs = require('fs');
  return fs.readFileSync('input.txt').toString();
});
```

but this will NOT work [ES6 module format]

```js
let testPreval = preval(() => {
  import { moduleFunction } from 'moduleName';
  // error: [!] (plugin svelte) SyntaxError: 'import' and 'export' may only appear at the top level
  return moduleFunction();
});
```

to use ES6 modules  
you must transpile to commonJS format

```sh
npm i -D @babel/core @babel/cli \
  @babel/plugin-transform-modules-commonjs

./node_modules/@babel/cli/bin/babel.js \
  --plugins @babel/plugin-transform-modules-commonjs \
  src/module.js > src/module.cjs
```

and then use with

```js
let testPreval = preval(() => {
  const moduleName = require('/absolute/path/to/module.cjs');
  return moduleName.moduleFunction();
});
```

## using modules with relative paths

require works relative to the directory of `sveltePreval.js`, so

```js
let res = preval(() => require('./src/script.js').someProp);
```

will try to require `node_modules/svelte-preval/src/src/script.js`

you could fix that with a relative path like `../../../src/script.js`  
but this is not portable  
for example this breaks with `pnpm` package manager  
cos symlinks are unidirectional and `../../../` is the pnpm global store

better solution: use absolute paths

in your `rollup.config.js` set

```js
        sveltePreval({
          baseDir: __dirname, // directory of rollup.config.js
        }),
```

and in your `App.svelte` write

```js
let res = preval(({baseDir}) => require(baseDir+'/src/script.js').someProp);
```

## more use samples

### unpack array

```js
let [a, b] = preval(() => ([
  Math.PI * 0.5,
  Math.sqrt(2),
]));

// result
let [a, b] = [1.5707963267948966, 1.4142135623730951];

```

### unpack properties to global scope

```js
Object.assign(window, preval(() => ({
  a: Math.PI * 0.5,
  b: Math.sqrt(2),
})));

// result
Object.assign(window, {
  a: 1.5707963267948966,
  b: 1.4142135623730951
});

```

### preval functions

```js
let testPrevalFuncs = preval(()=>([
  ()=>'hello',
  ()=>('world'),
  ()=>{return 'foo'},
  function(){return 'bar'},
]));

// result
window.testPreval.funcs = [
  () => "hello",
  () => "world",
  () => "foo",
  function () {
    return "bar";
  }
];
```

### get file list

```js
const ace_assets = preval(() => {

  const glob = require('glob');

  function bn(val){
    return val.match(/\/?([^/]+)\.js/)[1];
  }

  return {
    modes: glob.sync('node_modules/brace/mode/*.js').map(bn),
    themes: glob.sync('node_modules/brace/theme/*.js').map(bn),
  };

});

// result:
const ace_assets = {
  modes: [
    "abap",
    "abc",
    // ....
  ],
  themes: [
    "ambiance",
    "chaos",
    // ....
  ]
};

```

### inline asset files

```js
// inline asset files to javascript on compile time
// move to end of script for faster page load

// set options.baseDir in rollup.config.js:
// sveltePreval({baseDir: __dirname})
// so file paths are relative to project root

// install dependency:
// npm i -D mime-types

let fotoData = preval(function(options) {

  const imgBase = '/src/images';
  let fotoData = [
    {uri: '/homer.jpg', name: 'Homer'},
    {uri: '/lisa.webp', name: 'Lisa'},
    {uri: 'data:image/jpeg,', name: 'empty foto'},
  ];

  const fs = require('fs');
  const mime = require('mime-types');

  return fotoData.map(({uri, name}) => {

    // options.baseDir is defined in rollup.config.js
    const fileAbs = options.baseDir + imgBase + uri;

    if (!fs.existsSync(fileAbs)) {
      console.log('error in preval inline: no such file: '+fileAbs);
      return {uri, name}; // no change
    }

    const fileType = mime.lookup(fileAbs)
      || 'application/octet-stream';
    const base64data = fs.readFileSync(
      fileAbs, {encoding: 'base64'}
    );
    const dataUri = 'data:'+fileType+';base64,'+base64data;

    return {uri: dataUri, name};
  });

});

// result:
let fotoData = [
  {uri: 'data:image/jpeg,....', name: 'Homer'},
  {uri: 'data:image/webp,....', name: 'Lisa'},
  {uri: 'data:image/jpeg,', name: 'empty foto'},
];

```

these outputs are prettified by svelte  
the script output is minified to preserve line numbers  
cos the svelte preprocessor accepts no sourcemaps

## notes

wait for [svelte PR #5015 add source map support for preprocessors](https://github.com/sveltejs/svelte/pull/5015)  
and use sourcemap instead of minify  
to keep line numbers

support ES6 module format  
transform require-d modules on the fly  
to commonJS format, compatible with require()  
see "import modules"

allow to pass variables to preval  
or: make preval aware of the previous script environment  
assume other variables as static  
let envVar = 'hello'  
let prevalTest = preval(() => (envVar+' world'))

run before svelte js parser?  
for now, svelte fails on parse errors  
which per se is ok,  
but "pre process" should run before svelte, no?  
change `<script type="x">`?

expand this to use the [sweet.js macro system](https://jlongster.com/Stop-Writing-JavaScript-Compilers--Make-Macros-Instead)  
see: sweetjs macro [constexpr](https://gist.github.com/natefaubion/f4be4c8531ef45de87b4) - evaluate expressions at compile time
