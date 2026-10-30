import test from "node:test";
import assert from "node:assert/strict";
import { freepollsCard, freepollsLink, parsePoll } from "./freepolls.ts";

const POLL = "FhT3HnNwsKk7aa5MaGh9dtLFMcAHD8KdwYV2Sw7RVezY";
const link = `vote! http://127.0.0.1:7509/v1/contract/web/X/#/f/${POLL}.${"ab".repeat(60)} #poll`;
const state = (schema: object, answers: object[]) =>
  new TextEncoder().encode(JSON.stringify({
    schema_json: JSON.stringify(schema),
    schema_sig: "x",
    responses: Object.fromEntries(answers.map((a, i) => [String(i), { ts: 1, answers_json: JSON.stringify(a), sig: "x" }])),
  }));

test("freepolls: the poll of a link in a caption", () => {
  assert.equal(freepollsLink(link), POLL);
  assert.equal(freepollsLink("#/f/short.abc"), null);
  assert.match(freepollsCard(link), new RegExp(`data-poll="${POLL}"`));
  assert.equal(freepollsCard("plain"), "");
});

test("freepolls: a poll state is tallied", () => {
  const qs = [
    { id: "a", kind: "single", text: "Pick", options: ["x", "y"], required: true },
    { id: "b", kind: "multi", text: "Any", options: ["p", "q"], required: false },
    { id: "c", kind: "avail", text: "When", options: ["mon", "tue"], required: false },
    { id: "d", kind: "text", text: "Why", options: [], required: false },
  ];
  const p = parsePoll(state({ title: "T", questions: qs, allowed: [] }, [
    { a: 1, b: [0, 1, 1], c: [1, 2], d: "hi" },
    { a: 1, b: [1], c: [1, 1] },
    { a: 9, b: "bad" }, // out of range or malformed: counted as answered, tallies nothing
  ]))!;
  assert.equal(p.responses, 3);
  assert.equal(p.invite, true);
  assert.deepEqual(p.questions.map((q) => q.counts), [[0, 2], [1, 2], [2, 1], []]);
  assert.equal(p.questions[3].answered, 1);
  assert.equal(parsePoll(new TextEncoder().encode("nope")), null);
});
