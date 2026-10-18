import { test } from "node:test";
import assert from "node:assert/strict";
import { safeStorage } from "./storage.ts";

test("safeStorage: stores and retrieves items without throwing", () => {
  safeStorage.setItem("test_key", "test_val");
  assert.equal(safeStorage.getItem("test_key"), "test_val");

  safeStorage.removeItem("test_key");
  assert.equal(safeStorage.getItem("test_key"), null);
});

test("safeStorage: works when localStorage throws SecurityError", () => {
  const origLocalStorage = (globalThis as any).localStorage;
  try {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new DOMException(
          "Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.",
          "SecurityError"
        );
      },
      configurable: true,
    });

    safeStorage.setItem("sandboxed_key", "secret123");
    assert.equal(safeStorage.getItem("sandboxed_key"), "secret123");
    safeStorage.removeItem("sandboxed_key");
    assert.equal(safeStorage.getItem("sandboxed_key"), null);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      value: origLocalStorage,
      configurable: true,
      writable: true,
    });
  }
});
