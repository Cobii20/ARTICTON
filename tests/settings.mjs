import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUserSettings, saveUserSetting } from '../src/utils/userSettings.js';

test('light mode is the default and XL persists without being downgraded', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.document = { documentElement: { classList: { toggle() {} }, dataset: {}, style: {} } };
  try {
    assert.equal(getUserSettings().darkMode, false);
    saveUserSetting('fontSize', 'extra-large');
    assert.equal(getUserSettings().fontSize, 'extra-large');
    assert.equal(document.documentElement.dataset.fontSize, 'extra-large');
    saveUserSetting('darkMode', true);
    assert.equal(getUserSettings().darkMode, true);
    assert.equal(document.documentElement.dataset.theme, 'dark');
  } finally {
    delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.document;
  }
});
