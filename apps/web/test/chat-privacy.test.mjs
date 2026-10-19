import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function mountPrivacy(visibility = "visible") {
  const document = new EventTarget();
  document.visibilityState = visibility;
  document.hasFocus = () => false;
  const window = new EventTarget();
  let obscured;
  let cleanup;
  let updates = 0;
  const exports = {};
  const source = readFileSync(new URL("../features/chat/use-chat-privacy.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  runInNewContext(outputText, {
    exports, document, window,
    require(name) {
      assert.equal(name, "react");
      return {
        useState(initial) {
          obscured = initial;
          return [initial, (value) => { obscured = value; updates++; }];
        },
        useEffect(effect) { cleanup = effect(); },
      };
    },
  });
  exports.useChatPrivacy();
  return { document, window, obscured: () => obscured, updates: () => updates, unmount: () => cleanup() };
}

test("visible chat stays usable when browser controls take focus", () => {
  const page = mountPrivacy();
  assert.equal(page.obscured(), false);
  page.window.dispatchEvent(new Event("blur"));
  page.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(page.obscured(), false);
});

test("backgrounding hides chat and returning restores it without a focus event", () => {
  const page = mountPrivacy();
  for (let cycle = 0; cycle < 3; cycle++) {
    page.document.visibilityState = "hidden";
    page.document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(page.obscured(), true);
    page.document.visibilityState = "visible";
    page.document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(page.obscured(), false);
  }
});

test("a hidden initial page is covered and pageshow resyncs restored pages", () => {
  const page = mountPrivacy("hidden");
  assert.equal(page.obscured(), true);
  page.document.visibilityState = "visible";
  page.window.dispatchEvent(new Event("pageshow"));
  assert.equal(page.obscured(), false);
});

test("unmount removes privacy listeners", () => {
  const page = mountPrivacy();
  page.unmount();
  const updates = page.updates();
  page.document.visibilityState = "hidden";
  page.document.dispatchEvent(new Event("visibilitychange"));
  page.window.dispatchEvent(new Event("pageshow"));
  assert.equal(page.updates(), updates);
});
