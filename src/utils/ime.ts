export interface ImeKeyboardEventLike {
  key?: string;
  keyCode?: number;
  isComposing?: boolean;
  nativeEvent?: {
    isComposing?: boolean;
    keyCode?: number;
  };
}

export function isImeComposing(
  event: ImeKeyboardEventLike,
  composing = false,
): boolean {
  const native = event.nativeEvent ?? event;
  return Boolean(
    composing ||
      native.isComposing ||
      event.isComposing ||
      native.keyCode === 229 ||
      event.keyCode === 229 ||
      event.key === "Process",
  );
}
