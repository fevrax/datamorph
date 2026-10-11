import assert from "node:assert/strict";
import { test } from "node:test";
import { renumberProtoFields } from "./protoFieldNumbers";

test("renumbers each message in declaration order, sharing the sequence with oneofs", () => {
  const source = `syntax = "proto3";
message User {
  string name = 8;
  message Address { string city = 9; string street = 3; }
  map<string, .example.User.Address> addresses = 20;
  oneof contact { string email = 6; string phone = 4; }
  repeated Address recent = 2;
}
message Other { bool active = 100; }`;
  const expected = source
    .replace("name = 8", "name = 1")
    .replace("city = 9", "city = 1")
    .replace("street = 3", "street = 2")
    .replace("addresses = 20", "addresses = 2")
    .replace("email = 6", "email = 3")
    .replace("recent = 2", "recent = 5")
    .replace("active = 100", "active = 1");
  assert.equal(renumberProtoFields(source), expected);
  assert.equal(renumberProtoFields(expected), expected);
});

test("preserves options, defaults, enum values, RPCs, comments and CRLF formatting", () => {
  const source = [
    'syntax="proto2";',
    "// optional string ignored = 30; {",
    'option (config) = { message: "fake = 88; }" count: 31 };',
    "message User {",
    '\toption (custom) = { count: 22 note: "\\"string x = 50;" };',
    "\tenum State { UNKNOWN = 0; ACTIVE = 10; }",
    '\toptional string name /* = 55; } */ = /* tag */ 9 [default = "https://host/{x};", (foo) = { value: 20 }];',
    "\toptional int64 id = 4 [default = -9223372036854775808];",
    "}",
    "service Users { rpc Get(User) returns (User) { option (rpc) = 17; } }",
  ].join("\r\n");
  assert.equal(
    renumberProtoFields(source),
    source.replace("*/ 9 [", "*/ 1 [").replace("id = 4 [", "id = 2 ["),
  );
});

test("uses reserved and extension ranges declared anywhere in the message", () => {
  const source = `edition = "2023";
message Sample {
  string first = 10;
  reserved 1, 3 to 5;
  reserved "old_name";
  string second = 20;
  extensions 7 to 9 [declaration = { number: 7 full_name: ".extra" type: "int32" }];
  string third = 30;
  reserved old_field, another_old_field;
  string fourth = 40;
  reserved 12 to max;
}`;
  assert.equal(
    renumberProtoFields(source),
    source
      .replace("first = 10", "first = 2")
      .replace("second = 20", "second = 6")
      .replace("third = 30", "third = 10")
      .replace("fourth = 40", "fourth = 11"),
  );
});

test("skips the implementation-reserved range and overlapping reservations", () => {
  const source = `message Sample {
  int32 first = 1;
  int32 second = 2;
  reserved 1 to 18999, 100 to 20001, 20002;
}`;
  assert.equal(
    renumberProtoFields(source),
    source
      .replace("first = 1;", "first = 20003;")
      .replace("second = 2;", "second = 20004;"),
  );
  const systemRange = "message M { reserved 1 to 18999; string a = 1; }";
  assert.equal(
    renumberProtoFields(systemRange),
    systemRange.replace("a = 1", "a = 20000"),
  );
});

test("supports proto2 groups and preserves extend declarations", () => {
  const source = `syntax = 'proto2';
message User {
  optional group Result = 7 {
    required string value = 6;
    optional group Nested = 8 { optional bool flag = 4; }
  }
  optional string name = 9;
  extend User { optional string extra = 100; }
  extensions 100 to max;
}
extend User { optional int32 another = 101; }`;
  assert.equal(
    renumberProtoFields(source),
    source
      .replace("Result = 7", "Result = 1")
      .replace("value = 6", "value = 1")
      .replace("Nested = 8", "Nested = 2")
      .replace("flag = 4", "flag = 1")
      .replace("name = 9", "name = 2"),
  );
});

test("recognizes hexadecimal and octal field numbers and reserved ranges", () => {
  const source =
    "message M { reserved 01, 0x2 to 04; int32 a = 0xA; int32 b = 010; }";
  assert.equal(
    renumberProtoFields(source),
    source.replace("a = 0xA", "a = 5").replace("b = 010", "b = 6"),
  );
});

test("accepts field names that match JavaScript object prototype properties", () => {
  assert.equal(
    renumberProtoFields(
      "message M { string constructor = 9; string toString = 8; string __proto__ = 7; }",
    ),
    "message M { string constructor = 1; string toString = 2; string __proto__ = 3; }",
  );
});

test("rejects incomplete declarations and exhausted ranges without returning partial edits", () => {
  for (const source of [
    "message M { string a = 9; string b = 2; /* unfinished",
    'message M { string a = 9 [default = "unfinished]; }',
    "message M { string a = 9;",
    "message M { string a = 9 }",
    "message M { string a = 9; string b = ; }",
    "message M { reserved 5 to 2; string a = 9; }",
    "message M { reserved 1 to max; string a = 9; }",
  ]) {
    assert.throws(() => renumberProtoFields(source), /Protobuf/);
  }
});

test("empty input and schemas without message fields stay unchanged", () => {
  for (const source of [
    "",
    " \r\n",
    "enum Status { ZERO = 0; OK = 9; }",
    "message M { option deprecated = true; }",
  ]) {
    assert.equal(renumberProtoFields(source), source);
  }
});
