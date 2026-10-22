import React from "react";

const JsonAIRepairPage = React.lazy(() => import("./jsonAIRepairPage"));
const JsonTypeConverterPage = React.lazy(
  () => import("./jsonTypeConverterPage"),
);
const DataFormatConverterPage = React.lazy(
  () => import("./dataFormatConverterPage"),
);
const JwtParsePage = React.lazy(() => import("./jwtParsePage"));
const JsonKeyNamingPage = React.lazy(() => import("./jsonKeyNamingPage"));
const EncodingConverterPage = React.lazy(
  () => import("./encodingConverterPage"),
);

const JsonPathPage = React.lazy(() => import("./jsonFilterPage"));
const ProtoSortPage = React.lazy(() => import("./protoSortPage"));

export const toolComponentRegistry = {
  protoSort: ProtoSortPage,
  jsonPath: JsonPathPage,
  jsonAIRepair: JsonAIRepairPage,
  jsonTypeConverter: JsonTypeConverterPage,
  dataFormatConverter: DataFormatConverterPage,
  jwtParse: JwtParsePage,
  jsonKeyNaming: JsonKeyNamingPage,
  encodingConverter: EncodingConverterPage,
} satisfies Record<string, React.LazyExoticComponent<React.ComponentType>>;

export type ToolId = keyof typeof toolComponentRegistry;

export const getToolComponent = (toolId: string) => {
  return toolComponentRegistry[toolId as ToolId];
};
