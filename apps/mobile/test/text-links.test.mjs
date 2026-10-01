import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitTextLinks } from "../src/utils/text-links.ts";

describe("Text links", () => {
  it("recognizes web URLs and bare domains in Arabic and multiline text", () => {
    const content = "زر https://example.com/a?q=1&b=2 ثم\nwww.example.org أو example.net/path";
    const parts = splitTextLinks(content);
    assert.equal(parts.map((part) => part.text).join(""), content);
    assert.deepEqual(parts.filter((part) => part.href).map((part) => part.href), [
      "https://example.com/a?q=1&b=2", "https://www.example.org", "https://example.net/path",
    ]);
  });
  it("preserves punctuation outside links and balanced parentheses in paths", () => {
    const content = "(https://example.com/a_(b)). https://example.org،";
    const parts = splitTextLinks(content);
    assert.equal(parts.map((part) => part.text).join(""), content);
    assert.deepEqual(parts.filter((part) => part.href).map((part) => part.text), [
      "https://example.com/a_(b)", "https://example.org",
    ]);
  });
  it("keeps plain text, email addresses, and unsafe schemes as text", () => {
    for (const content of ["", "مرحبا", "user@example.com", "javascript:example.com", "ftp://example.com", "https://user:password@example.com"]) {
      assert.equal(splitTextLinks(content).some((part) => part.href), false);
      assert.equal(splitTextLinks(content).map((part) => part.text).join(""), content);
    }
  });
});
