import {
  createContext,
  useContext,
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  useTabStore,
  type ToolId,
  type ToolStateById,
  type ToolStateValue,
} from "@/store/useTabStore";
export const ToolContext = createContext<string>("");
const inputFields = new Set([
  "inputValue",
  "originalValue",
  "plainText",
  "jsonInput",
  "jwtToken",
]);
export function useToolState<T>(
  name: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(ToolContext);
  const activeKey = useTabStore((s) => s.activeTabKey);
  const key = context || activeKey;
  const stored = useTabStore((s) => s.getTabByKey(key)?.toolState[name]);
  const source = useTabStore((s) => s.getTabByKey(key)?.content);
  const [fallback] = useState(() =>
    inputFields.has(name) && source
      ? source
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  );
  const value = (stored === undefined ? fallback : stored) as T;
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      const current =
        useTabStore.getState().getTabByKey(key)?.toolState[name] ?? fallback;
      const updated =
        typeof next === "function" ? (next as (v: T) => T)(current as T) : next;
      useTabStore.getState().setToolState(key, name, updated as ToolStateValue);
    },
    [key, name, fallback],
  );
  return [value, set];
}

/** Each tool's parameter names and values are checked against its own schema. */
export function createToolStateHook<Id extends ToolId>(_id: Id) {
  return function useTypedToolState<
    Name extends keyof ToolStateById[Id] & string,
  >(
    name: Name,
    initial: ToolStateById[Id][Name] | (() => ToolStateById[Id][Name]),
  ) {
    return useToolState<ToolStateById[Id][Name]>(name, initial);
  };
}
