import type { AIRouteType, OpenAIConfig } from "../store/useOpenAIConfigStore";

export const AI_ROUTE_LABELS: Record<AIRouteType, string> = {
  default: "站点API",
  custom: "私有API",
  utools: "uTools AI",
  ssooai: "SSOOAI",
};

export const AI_ROUTE_CONFIG_KEYS = {
  default: "defaultRoute",
  custom: "customRoute",
  utools: "utoolsRoute",
  ssooai: "ssooaiRoute",
} as const;

export const AI_ROUTE_MODEL_KEYS = {
  default: "defaultModels",
  custom: "customModels",
  utools: "utoolsModels",
  ssooai: "ssooaiModels",
} as const;

export function getAIModels(state: OpenAIConfig, route: AIRouteType) {
  return state[AI_ROUTE_MODEL_KEYS[route]];
}

export function getAISelection(
  state: OpenAIConfig,
  route: AIRouteType,
  model = getAIModels(state, route)[0]?.value,
): Partial<OpenAIConfig> | null {
  if (!model || !getAIModels(state, route).some((item) => item.value === model))
    return null;
  const key = AI_ROUTE_CONFIG_KEYS[route];
  return { routeType: route, [key]: { ...state[key], model } };
}
