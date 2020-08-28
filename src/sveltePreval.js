// sveltePreval.js
// compile time eval for svelte components
// license CC-0 + no warranty

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

module.exports = function sveltePreval(options={

  // true = preval in all <script>
  // false = preval only in <script scriptAttr>
  defaultOn: true,

  // App.svelte: <script scriptAttr="funcName">
  // default: <script preval="preval">
  funcName: "preval",

  // App.svelte: <script scriptAttr>
  // default: <script preval>
  scriptAttr: "preval",

}) {

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
      // TODO allow to transpile from typescript etc
      let ast;
      try {
        ast = acorn_parse(content, {
          ecmaVersion: 11, // year 2020
          sourceType: "module",
        });
      } catch(e) {

        const errCtxLen = 50;
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

          // TODO allow to transpile from typescript etc
          const evalRes = eval("(" + arg0Src + ")()");

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
