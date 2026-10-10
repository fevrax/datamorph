import assert from "node:assert/strict";
import test from "node:test";
import { useOpenAIConfigStore } from "../store/useOpenAIConfigStore";
import { storage } from "../lib/indexedDBStore";
import {
  AI_ROUTE_LABELS,
  getAIModels,
  getAISelection,
} from "./aiModelSelection";

test("picker only offers discovered models and changes route/model atomically", () => {
  const state = useOpenAIConfigStore.getState();
  assert.equal(state.routeType, "default");
  assert.equal(AI_ROUTE_LABELS.default, "站点API");
  assert.equal(AI_ROUTE_LABELS.custom, "私有API");
  for (const route of ["default", "custom", "ssooai", "utools"] as const) {
    assert.deepEqual(getAIModels(state, route), []);
    assert.equal(getAISelection(state, route), null);
  }
  const config = {
    ...state,
    customModels: [
      { value: "first", label: "First" },
      { value: "second", label: "Second" },
    ],
    customRoute: {
      ...state.customRoute,
      apiKey: "test-only",
      model: "legacy-manual-model",
      temperature: 0,
    },
  };
  assert.deepEqual(getAISelection(config, "custom"), {
    routeType: "custom",
    customRoute: { ...config.customRoute, model: "first" },
  });
  assert.equal(getAISelection(config, "custom", "legacy-manual-model"), null);
  assert.deepEqual(getAIModels({ ...config, customModels: [] }, "custom"), []);
});

test("API discovery selects first, preserves valid choices, replaces stale lists, and fails closed", async () => {
  const original = useOpenAIConfigStore.getState();
  const originalFetch = globalThis.fetch;
  const originalSave = storage.setItem;
  const originalRead = storage.getItem;
  const saved: unknown[] = [];
  storage.setItem = async (_key, value) => {
    saved.push(value);
    return value;
  };
  let ids: unknown[] = ["first", "second", "first", null, ""];
  let status = 200;
  let lastURL = "";
  let lastAuth: string | null = null;
  globalThis.fetch = async (input, init) => {
    lastURL = String(input);
    lastAuth = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
      status,
    });
  };
  try {
    useOpenAIConfigStore.getState().resetConfig();
    storage.getItem = async <T>() =>
      ({
        ...original,
        defaultRoute: { ...original.defaultRoute, model: "legacy" },
        defaultModels: [{ value: "legacy", label: "Legacy" }],
      }) as unknown as T;
    await useOpenAIConfigStore.getState().syncConfig();
    assert.deepEqual(useOpenAIConfigStore.getState().defaultModels, []);
    assert.equal(useOpenAIConfigStore.getState().getCurrentModel(), "");
    await useOpenAIConfigStore.getState().fetchDefaultModels();
    assert.equal(lastURL, "/api/ai/v1/models");
    assert.equal(lastAuth, null);
    assert.equal(useOpenAIConfigStore.getState().defaultRoute.model, "first");
    assert.equal(useOpenAIConfigStore.getState().defaultModels.length, 2);
    useOpenAIConfigStore
      .getState()
      .updateDefaultRouteConfig({ model: "second" });
    await useOpenAIConfigStore.getState().fetchDefaultModels();
    assert.equal(useOpenAIConfigStore.getState().defaultRoute.model, "second");
    ids = ["replacement"];
    await useOpenAIConfigStore.getState().fetchDefaultModels();
    assert.equal(
      useOpenAIConfigStore.getState().defaultRoute.model,
      "replacement",
    );
    assert.ok(saved.length);
    assert.equal("defaultModels" in (saved.at(-1) as object), false);

    status = 503;
    await assert.rejects(
      useOpenAIConfigStore.getState().fetchDefaultModels(),
      /站点API尚未配置/,
    );
    assert.deepEqual(useOpenAIConfigStore.getState().defaultModels, []);
    assert.equal(useOpenAIConfigStore.getState().getCurrentModel(), "");
    status = 200;
    ids = [];
    await useOpenAIConfigStore.getState().fetchDefaultModels();
    assert.equal(useOpenAIConfigStore.getState().defaultRoute.model, "");

    for (const route of ["custom", "ssooai"] as const) {
      const key = route === "custom" ? "customRoute" : "ssooaiRoute";
      const list = route === "custom" ? "customModels" : "ssooaiModels";
      useOpenAIConfigStore.setState({
        [key]: {
          ...original[key],
          apiKey: "test-only",
          proxyUrl: "https://example.com/v1/",
          model: "old",
        },
        [list]: [{ value: "old", label: "Old" }],
      });
      ids = ["api-first", "api-second"];
      await useOpenAIConfigStore.getState().fetchModels(route);
      assert.equal(lastURL, "https://example.com/v1/models");
      assert.equal(lastAuth, "Bearer test-only");
      assert.deepEqual(
        useOpenAIConfigStore.getState()[list].map((m) => m.value),
        ids,
      );
      assert.equal(useOpenAIConfigStore.getState()[key].model, "api-first");
    }

    let finish!: (response: Response) => void;
    globalThis.fetch = () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      });
    const pending = useOpenAIConfigStore.getState().fetchCustomModels();
    useOpenAIConfigStore
      .getState()
      .updateCustomRouteConfig({ proxyUrl: "https://new.example/v1" });
    finish(
      new Response(JSON.stringify({ data: [{ id: "old-provider-model" }] })),
    );
    await pending;
    assert.deepEqual(useOpenAIConfigStore.getState().customModels, []);
    assert.equal(useOpenAIConfigStore.getState().customRoute.model, "");

    const resolvers: Array<(response: Response) => void> = [];
    globalThis.fetch = () =>
      new Promise<Response>((resolve) => {
        resolvers.push(resolve);
      });
    const older = useOpenAIConfigStore.getState().fetchDefaultModels();
    const newer = useOpenAIConfigStore.getState().fetchDefaultModels();
    resolvers[1](new Response(JSON.stringify({ data: [{ id: "newest" }] })));
    await newer;
    resolvers[0](new Response(JSON.stringify({ data: [{ id: "obsolete" }] })));
    await older;
    assert.equal(useOpenAIConfigStore.getState().defaultRoute.model, "newest");
  } finally {
    globalThis.fetch = originalFetch;
    storage.setItem = originalSave;
    storage.getItem = originalRead;
    useOpenAIConfigStore.setState(original, true);
  }
});
