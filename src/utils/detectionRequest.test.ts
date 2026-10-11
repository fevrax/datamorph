import { test } from "node:test";
import assert from "node:assert/strict";
import { DetectionSession, type DetectionTicket } from "./detectionRequest";

test("out-of-order replies cannot replace a newer result, even after returning to identical content", async () => {
  const session = new DetectionSession();
  let language = "json";
  const pending: Array<() => void> = [];
  const request = (ticket: DetectionTicket, result: string) =>
    new Promise<void>((resolve) => {
      pending.push(() => {
        if (session.accepts(ticket)) language = result;
        resolve();
      });
    });
  const first = request(session.update("doc", "a: 1", "auto"), "ini");
  const second = request(session.update("doc", "<a/>", "auto"), "xml");
  const third = request(session.update("doc", "a: 1", "auto"), "yaml");
  pending[2]();
  pending[0]();
  pending[1]();
  await Promise.all([first, second, third]);
  assert.equal(language, "yaml");
});

test("document changes, clearing, manual mode and filename changes invalidate pending replies", () => {
  const session = new DetectionSession();
  const first = session.update("one", "{}", "auto");
  const second = session.update("two", "{}", "auto");
  assert.equal(session.accepts(first), false);
  assert.equal(session.accepts({ ...second, documentId: "one" }), false);
  session.update("two", "", "auto");
  assert.equal(session.accepts(second), false);
  const automatic = session.update("two", "{}", "auto");
  session.update("two", "{}", "manual");
  assert.equal(session.accepts(automatic), false);
  const manual = session.update("two", "{}", "manual");
  session.update("two", "{}", "manual", "source.yaml");
  assert.equal(session.accepts(manual), false);
});
