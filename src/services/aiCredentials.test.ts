import assert from "node:assert/strict";
import test from "node:test";

test("site route sends no browser credential and only uses the current origin", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const requests: { url: string; authorization: string | null }[] = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { protocol: "https:", origin: "https://json-tools.example" },
    },
  });
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
    });

    return new Response(
      JSON.stringify(
        String(input).endsWith("/models")
          ? { data: [{ id: "api-model" }] }
          : { choices: [{ message: { content: "ok" } }] },
      ),
      {
        headers: { "content-type": "application/json" },
      },
    );
  };

  // Select the browser transport after installing the mock, before the SDK loads.
  await import("openai/shims/web");
  const { OpenAIService } = await import("./openAIService");
  const { useOpenAIConfigStore } = await import(
    "../store/useOpenAIConfigStore"
  );
  const { storage } = await import("../lib/indexedDBStore");
  const originalSave = storage.setItem;
  storage.setItem = async (_key, value) => value;
  const originalState = useOpenAIConfigStore.getState();

  try {
    useOpenAIConfigStore.setState({ routeType: "default" });
    const service = OpenAIService.createInstance();

    await service.chat({ messages: [{ role: "user", content: "test" }] });
    assert.deepEqual(requests, [
      { url: "/api/ai/v1/models", authorization: null },
      {
        url: "https://json-tools.example/api/ai/v1/chat/completions",
        authorization: null,
      },
    ]);

    // The chosen service route must win over the store's currently selected route.
    useOpenAIConfigStore.setState({
      routeType: "default",
      customRoute: {
        ...originalState.customRoute,
        apiKey: "user-test-key",
        proxyUrl: "https://private.example/v1",
      },
    });
    service.updateConfig({ routeType: "custom", model: "test" });
    await service.chat({ model: "test", messages: [] });
    assert.deepEqual(requests[2], {
      url: "https://private.example/v1/chat/completions",
      authorization: "Bearer user-test-key",
    });

    for (const routeType of [
      "default",
      "utools",
      "ssooai",
      "custom",
    ] as const) {
      useOpenAIConfigStore.setState({
        routeType,
        ssooaiRoute: { ...originalState.ssooaiRoute, apiKey: "" },
        customRoute: { ...originalState.customRoute, apiKey: "" },
      });
      assert.equal(useOpenAIConfigStore.getState().getCurrentApiKey(), "");
    }
  } finally {
    storage.setItem = originalSave;
    globalThis.fetch = originalFetch;
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    useOpenAIConfigStore.setState(originalState, true);
  }
});
