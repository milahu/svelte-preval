# svelte-preval

preval for svelte

performant:  
eval static expressions at compile time  
allow shorter load times for client

readable:  
avoid "magic numbers"  
colocate "all the code" in one place

powerful:  
use any node package on compile time

license = public domain = CC-0  
warranty = none

## install

```sh
npm i -D https://github.com/milahu/svelte-preval.git
```

### install dependencies

TODO better?

```sh
cd node_modules/svelte-preval
npm install
```

peerDependencies are provided by svelte

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
        }),
      ],
    }),
  ],
};
```

## use samples

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

```js
// unpack array
let [a, b] = preval(() => ([
  Math.PI * 0.5,
  Math.sqrt(2),
]));

// result
let [a, b] = [1.5707963267948966, 1.4142135623730951];

```

```js
// unpack properties to global scope
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

```js
// preval functions
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

```js
// get file list
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

these outputs are prettified by svelte  
the script output is minified to preserve line numbers  
cos the svelte preprocessor accepts no sourcemaps

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

## using modules in preval

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
  const moduleName = require('./path/to/module.cjs');
  return moduleName.moduleFunction();
});
```

## notes

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
