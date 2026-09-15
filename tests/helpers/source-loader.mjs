import { registerHooks, stripTypeScriptTypes } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileScript, parse } from "@vue/compiler-sfc";

const root = new URL("../../src/", import.meta.url);

// Execute production TS and SFC setup with Node's runner, without a browser or
// generated source files. Vue's real renderer below owns lifecycle hooks.
registerHooks({
  resolve(specifier, context, nextResolve) {
    let url;
    if (specifier.startsWith("@/")) url = new URL(specifier.slice(2), root);
    else if (specifier === "@prism-fusion/plugin-runtime/remote") {
      url = new URL("vendor/prism-fusion-plugin-runtime/remote.ts", root);
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith(root.href)) {
      url = new URL(specifier, context.parentURL);
    }
    if (url) {
      for (const path of [url.href, `${url.href}.ts`, `${url.href}/index.ts`, url.href.replace(/\.js$/, ".ts")]) {
        if (existsSync(fileURLToPath(path)) && statSync(fileURLToPath(path)).isFile()) {
          return { url: path, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root.href) && /\.(ts|vue)$/.test(url)) {
      let source = readFileSync(new URL(url), "utf8");
      if (url.endsWith(".vue")) {
        source = compileScript(parse(source).descriptor, { id: url }).content;
      }
      source = stripTypeScriptTypes(source.replaceAll("import.meta.env", "({})"),
        { mode: url.includes("/vendor/") ? "transform" : "strip" });
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
