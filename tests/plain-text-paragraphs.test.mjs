import assert from "node:assert/strict";
import test from "node:test";
import { splitPlainTextParagraphs } from "../project-core/plain-text-paragraphs.js";

test("plain-text paragraph splitter retains a single paragraph", () => {
  assert.deepEqual(splitPlainTextParagraphs("One paragraph."), ["One paragraph."]);
});

test("plain-text paragraph splitter creates paragraphs from blank lines", () => {
  assert.deepEqual(splitPlainTextParagraphs("First.\n\nSecond."), ["First.", "Second."]);
});

test("plain-text paragraph splitter normalizes line endings and blank runs", () => {
  assert.deepEqual(splitPlainTextParagraphs("\r\n First\r\ncontinued \r\n\r\n\r\n Second \r\n"), ["First continued", "Second"]);
});

test("plain-text paragraph splitter never interprets HTML-like author text", () => {
  assert.deepEqual(splitPlainTextParagraphs("<strong>Text</strong>\n\n<script>alert(1)</script>"), ["<strong>Text</strong>", "<script>alert(1)</script>"]);
});
