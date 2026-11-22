export const YamlSample = `service: datamorph
version: "2.4"
views:
  - code # Monaco smart editing
  - tree # Tree structure view
  - table # Table filtering & export
  - columns
features:
  autoDetect: true
  smartDecode:
    - timestamp
    - base64
    - unicode
    - color
`;

export const ProtoSample = `syntax = "proto3";

package datamorph.v1;

message DocumentEvent {
  int64 id = 1;
  string format = 2;
  repeated string tags = 3;
  int64 created_at = 4;
  bool auto_detected = 5;
}
`;
