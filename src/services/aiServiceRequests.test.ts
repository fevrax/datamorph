import assert from "node:assert/strict";
import test from "node:test";

test("service uses instance model/temperature, preserves zero, and maps only site 503 errors", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  let unavailable = false;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { protocol: "https:", origin: "https://mock.example" } },
  });
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));

    bodies.push(body);
    if (unavailable)
      return new Response(
        JSON.stringify({ error: { message: "unavailable" } }),
        { status: 503 },
      );

    return body.stream
      ? new Response(
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
          { headers: { "content-type": "text/event-stream" } },
        )
      : new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { headers: { "content-type": "application/json" } },
        );
  };
  await import("openai/shims/web");
  const { OpenAIService } = await import("./openAIService");
  const { useOpenAIConfigStore } = await import(
    "../store/useOpenAIConfigStore"
  );
  const originalState = useOpenAIConfigStore.getState();

  try {
    useOpenAIConfigStore.setState({
      routeType: "default",
      customRoute: {
        ...originalState.customRoute,
        apiKey: "mock-only",
        proxyUrl: "https://private.example/v1",
      },
    });
    const service = OpenAIService.createInstance();

    service.updateConfig({
      routeType: "custom",
      model: "instance-model",
      temperature: 0.2,
    });
    await service.chat({ messages: [], temperature: 0 });
    assert.equal(bodies[0].model, "instance-model");
    assert.equal(bodies[0].temperature, 0);
    await service.chat({ messages: [] });
    assert.equal(bodies[1].temperature, 0.2);
    const completed: string[] = [];

    assert.equal(
      await service.createChatCompletion([], {
        onComplete: (value) => completed.push(value),
      }),
      true,
    );
    assert.equal(bodies[2].model, "instance-model");
    assert.equal(bodies[2].temperature, 0.2);
    assert.deepEqual(completed, ["ok"]);

    unavailable = true;
    const errors: Error[] = [];

    assert.equal(
      await service.createChatCompletion([], {
        onError: (error) => errors.push(error),
      }),
      false,
    );
    assert.match(errors[0].message, /unavailable/);
    service.updateConfig({ routeType: "default", model: "site-model" });
    assert.equal(
      await service.createChatCompletion([], {
        onError: (error) => errors.push(error),
      }),
      false,
    );
    assert.match(errors[1].message, /站点.*未配置.*私有API/);
    assert.equal(errors.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    useOpenAIConfigStore.setState(originalState, true);
  }
});
