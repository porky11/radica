import test from "node:test";
import assert from "node:assert/strict";
import { freepollsCard, freepollsLink, parsePoll, pollHref, pollSchema, votable } from "./freepolls.ts";

const POLL = "FhT3HnNwsKk7aa5MaGh9dtLFMcAHD8KdwYV2Sw7RVezY";
const link = `vote! http://127.0.0.1:7509/v1/contract/web/X/#/f/${POLL}.${"ab".repeat(60)} #poll`;
const state = (schema: object, answers: object[]) =>
  new TextEncoder().encode(JSON.stringify({
    schema_json: JSON.stringify(schema),
    schema_sig: "x",
    responses: Object.fromEntries(answers.map((a, i) => [String(i), { ts: 1, answers_json: JSON.stringify(a), sig: "x" }])),
  }));

test("freepolls: the poll of a link in a caption", () => {
  assert.deepEqual(freepollsLink(link), { id: POLL, params: "ab".repeat(60) });
  assert.equal(freepollsLink("#/f/short.abc"), null);
  assert.match(freepollsCard(link), new RegExp(`data-poll="${POLL}" data-params="${"ab".repeat(60)}"`));
  // the link Radica writes for a poll it creates is one it reads back
  assert.deepEqual(freepollsLink(`Q?\n\n${pollHref("http://127.0.0.1:7509", POLL, "cd".repeat(70))}`), { id: POLL, params: "cd".repeat(70) });
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

test("freepolls: what can be voted on in Radica, and the schema it publishes", () => {
  const schema = pollSchema({ question: "Lunch?", options: ["pizza", "sushi"], multi: true });
  assert.deepEqual(schema.questions[0], { id: "q1", kind: "multi", text: "Lunch?", options: ["pizza", "sushi"], required: true });
  const open = parsePoll(state(schema, [{ q1: [0] }]))!;
  assert.equal(votable(open), true);
  assert.deepEqual(open.byKey["0"].answers, { q1: [0] });
  assert.equal(votable(parsePoll(state({ ...schema, allowed: [] }, []))!), false); // invite only: the invite secret votes
  assert.equal(votable(parsePoll(state({ title: "D", questions: [{ id: "a", kind: "avail", options: ["mon"] }] }, []))!), false);
});
