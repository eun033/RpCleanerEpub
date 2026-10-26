const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const file = new URL("./crack.muse.writer.user.js", `file://${__filename}`).pathname;
const source = fs.readFileSync(file, "utf8");
const start = source.indexOf("  function getTransKey");
const end = source.indexOf("  function getReferenceKey", start);
assert.ok(start > 0 && end > start, "번역 설정 함수를 찾을 수 없습니다.");

const values = new Map([
  ["cfgTransLang", "English"],
  ["cfgTransFormat", "{번역문} ({원문})"],
  ["cfgTransLang_room-a", "Japanese"],
  ["cfgTransFormat_room-a", "{원문} → {번역문}"],
  ["cfgTransLang_room-b", "__custom__"],
  ["cfgTransCustomLang_room-b", "Polish"],
  ["cfgTransFormat_room-b", "{번역문}"],
]);
const context = {
  TRANS_DEFAULT_FORMAT: "{번역문} ({원문})",
  getChatRoomId: () => "room-a",
  GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback,
};
vm.runInNewContext(`${source.slice(start, end)}\nthis.api = { getTransKey, getTargetLang, getTransFormatTemplate };`, context);

assert.equal(context.api.getTransKey("cfgTransLang", "room-a"), "cfgTransLang_room-a");
assert.equal(context.api.getTargetLang("room-a"), "Japanese");
assert.equal(context.api.getTransFormatTemplate("room-a"), "{원문} → {번역문}");
assert.equal(context.api.getTargetLang("room-b"), "Polish");
assert.equal(context.api.getTransFormatTemplate("room-b"), "{번역문}");
assert.equal(context.api.getTargetLang("legacy-room"), "English");
assert.equal(context.api.getTransFormatTemplate("legacy-room"), "{번역문} ({원문})");
assert.doesNotMatch(source, /GM_setValue\("cfgTrans(?:Lang|CustomLang|Format)"/);

console.log("room-specific translation settings: ok");
