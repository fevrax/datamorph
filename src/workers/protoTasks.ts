import { renumberProtoFields } from "../utils/protoFieldNumbers";

export interface ProtoTaskInput {
  action: "renumber-proto";
  content: string;
  language: string;
}
export function executeProtoTask(input: ProtoTaskInput): { content: string } {
  if (input.language !== "proto")
    throw new Error("重新排序编号仅支持 Protobuf");
  return { content: renumberProtoFields(input.content) };
}
