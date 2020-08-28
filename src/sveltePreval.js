// sveltePreval.js
// compile time eval for svelte components
// license CC0-1.0 + no warranty

// acorn = ast from javascript parser
// estree-walker = read-only AST tree walker
// tosource = object to javascript code generator
// magic-string = replace strings
// child_process = workaround for minifySync

const acorn_parse = require("acorn").parse;
const estree_walk = require("estree-walker").walk;
const magicString = require("magic-string");
const node_tosource = require("tosource");
const child_process = require('child_process');
const minifySync_exe = 'node_modules/svelte-preval/src/minify-es6-sync.js';

module.exports = function sveltePreval(options) {

  options = Object.assign(
    {},
    // default options
    {
      defaultOn: true,
      // true = preval in all <script>
      // false = preval only in <script scriptAttr>

      funcName: "preval",
      // App.svelte: <script scriptAttr="funcName">
      // default: <script preval="preval">

      scriptAttr: "preval",
      // App.svelte: <script scriptAttr>
      // default: <script preval>

      baseDir: '.',
      // set this to `__dirname` in rollup.config.js
      // so you can require local scripts like
      // let res = preval(({baseDir}) => {
      //   return require(baseDir+'/src/myScript.js').myProp;
      // });
      // default baseDir is
      // [..../]node_modules/svelte-preval/src
      // which is not portable
      // this breaks with pnpm, for example
      // cos pnpm has its node_modules outside your project path
      // and your project only has symlinks to pnpm's global store

    },
    options
  );

  return {

    // process <script> tags
    script({ content, attributes /*, filename*/ }) {

      // override global config per script
      // <script preval="local_funcName">
      if (options.scriptAttr in attributes) {
        if (attributes[options.scriptAttr] !== true) {
          options.funcName = attributes[options.scriptAttr];
        }
        // true means "empty attribute" <script preval>
        // --> keep default options.funcName
      }
      else if (options.defaultOn === false) {
        // no change
        return { code: content };
      }

      // parse script
      let ast;
      try {
        ast = acorn_parse(content, {
          ecmaVersion: 11, // year 2020
          sourceType: "module",
        });
      } catch(e) {

        const errCtxLen = 100;
        const errCtx = content.substring(
          Math.max(e.pos - errCtxLen, 0),
          Math.min(e.pos + errCtxLen, content.length),
        );
        console.log(`parse error context +-${errCtxLen}: ${errCtx}`);

        const errRaised = content.substring(
          e.raisedAt,
          Math.min(e.raisedAt + errCtxLen, content.length),
        );
        console.log(`parse error raised at: ${errRaised}`);

        throw(e);

      }

      let code = new magicString(content);

      estree_walk(ast, {

        //enter: async function (node, parent, prop, index) {
        enter: function (node, parent, prop, index) {

          if (
            node.type !== "CallExpression" ||
            node.callee.name !== options.funcName
          ) {
            // ignore this node
            return;
          }

          if (node.arguments.length !== 1) {
            return console.error(`preval usage: let res = ${options.funcName}(f);`);
          }

          const nodeSrc = content.substring(node.start, node.end);

          const arg0Src = content.substring(
            node.arguments[0].start,
            node.arguments[0].end
          );

          const addLines = (arg0Src.match(/\n/g) || []).length;

          // eval
          // pass options object from sveltePreval(options)
          // to the eval-ed function
          const evalRes = eval(`(${arg0Src})(options);`);

          // object to source
          let evalResSrc = node_tosource(evalRes);

          // pack expression (expr); to make minify happy
          evalResSrc = '('+evalResSrc+');';

          // call `async minify` wrapped as external script
          try {
            evalResSrc = child_process.execSync(
              "node "+minifySync_exe.replace(/([ \t])/g, '\\$1'), {
              input: evalResSrc,
              timeout: 10000,
              encoding: 'utf-8',
            }); 
          }
          catch (error) {
            // timeout or exit(1)
            console.log('error in minify:');
            console.log(error.stdout);
            throw new Error('minify failed');
          }

          if (evalResSrc[0] == '(' && evalResSrc.slice(-2) == ');') {
            evalResSrc = evalResSrc.slice(1, -2);
          } else {
            // braces were removed by minify
            // sample: ([1,2,3,4]); --> [1,2,3,4];
            evalResSrc = evalResSrc.slice(0, -1);
          }

          // add empty lines to keep line numbers without sourcemap
          evalResSrc += "\n".repeat(addLines);

          // patch the source
          code.overwrite(node.start, node.end, evalResSrc);

        },

      });

      return { code: code.toString() };

    },
  };
};
