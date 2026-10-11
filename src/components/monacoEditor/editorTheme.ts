import type * as monaco from "monaco-editor";

const DARK_THEME = "datamorph-dark";

export function getMonacoTheme(theme: string): string {
  if (theme === "vs-dark") return DARK_THEME;
  if (theme === "vs-light") return "vs";
  return theme;
}

/** Read the app's dark tokens even when Monaco first loads in light mode. */
export function registerEditorTheme(instance: typeof monaco): void {
  const probe = document.createElement("div");
  probe.className = "dark";
  probe.hidden = true;
  document.body.append(probe);
  try {
    const styles = getComputedStyle(probe);
    const color = (name: string) => styles.getPropertyValue(`--${name}`).trim();
    const background = color("background");
    const foreground = color("foreground");
    const surface = color("surface");
    const popover = color("popover");
    const muted = color("muted");
    const secondary = color("secondary");
    const subtle = color("muted-foreground");
    const border = color("border");
    const input = color("input");
    const primary = color("primary");
    const accent = color("accent");
    const success = color("success");
    const warning = color("warning");
    const danger = color("destructive");
    const key = color("editor-key");
    const string = color("editor-string");
    const keyword = color("editor-keyword");
    const token = (name: string, value: string) => ({
      token: name,
      foreground: value.slice(1),
    });

    instance.editor.defineTheme(DARK_THEME, {
      base: "vs-dark",
      inherit: true,
      rules: [
        token("", foreground),
        token("comment", color("editor-comment")),
        token("string", string),
        token("string.key", key),
        token("string.key.json", key),
        token("string.value", string),
        token("string.value.json", string),
        token("string.sql", string),
        token("string.escape", warning),
        token("key", key),
        token("identifier", key),
        token("type", key),
        token("attribute.name", key),
        token("attribute.value", string),
        token("attribute.value.number.css", warning),
        token("attribute.value.unit.css", warning),
        token("attribute.value.hex.css", string),
        token("variable", key),
        token("variable.predefined", primary),
        token("variable.parameter", key),
        token("tag", primary),
        token("metatag", primary),
        token("metatag.html", primary),
        token("metatag.xml", primary),
        token("metatag.content.html", string),
        token("meta.tag", string),
        token("number", warning),
        token("number.hex", warning),
        token("keyword", keyword),
        token("keyword.json", keyword),
        token("keyword.flow", keyword),
        token("keyword.flow.scss", keyword),
        token("constant", keyword),
        token("predefined.sql", keyword),
        token("regexp", string),
        token("annotation", subtle),
        token("delimiter", subtle),
        token("delimiter.html", subtle),
        token("delimiter.xml", subtle),
        token("operator", subtle),
        token("operator.scss", subtle),
        token("operator.sql", subtle),
        token("operator.swift", subtle),
        token("invalid", danger),
        token("string.invalid", danger),
        token("string.escape.invalid", danger),
      ],
      colors: {
        "editor.background": background,
        "editor.foreground": foreground,
        "editorGutter.background": background,
        "editorLineNumber.foreground": color("editor-line-number"),
        "editorLineNumber.activeForeground": primary,
        "editorCursor.foreground": primary,
        "editor.lineHighlightBackground": muted,
        "editor.lineHighlightBorder": "#00000000",
        "editor.selectionBackground": `${primary}33`,
        "editor.inactiveSelectionBackground": `${primary}1a`,
        "editor.selectionHighlightBackground": `${primary}1a`,
        "editor.selectionHighlightBorder": `${primary}40`,
        "editor.wordHighlightBackground": `${primary}1a`,
        "editor.wordHighlightStrongBackground": `${primary}26`,
        "editor.findMatchBackground": `${warning}33`,
        "editor.findMatchBorder": `${warning}99`,
        "editor.findMatchHighlightBackground": `${warning}1a`,
        "editor.findRangeHighlightBackground": `${primary}0d`,
        "editor.rangeHighlightBackground": `${primary}0d`,
        "editor.hoverHighlightBackground": `${primary}14`,
        "editorWhitespace.foreground": input,
        "editorIndentGuide.background1": border,
        "editorIndentGuide.activeBackground1": `${primary}66`,
        "editorBracketMatch.background": `${primary}26`,
        "editorBracketMatch.border": `${primary}80`,
        "editorBracketHighlight.foreground1": primary,
        "editorBracketHighlight.foreground2": string,
        "editorBracketHighlight.foreground3": warning,
        "editorBracketHighlight.foreground4": keyword,
        "editorBracketHighlight.foreground5": key,
        "editorBracketHighlight.foreground6": foreground,
        "editorBracketHighlight.unexpectedBracket.foreground": danger,
        "editorError.foreground": danger,
        "editorWarning.foreground": warning,
        "editorInfo.foreground": key,
        "editorOverviewRuler.border": border,
        "editorOverviewRuler.errorForeground": `${danger}b3`,
        "editorOverviewRuler.warningForeground": `${warning}b3`,
        "editorOverviewRuler.findMatchForeground": `${warning}80`,
        "editorOverviewRuler.selectionHighlightForeground": `${primary}66`,
        "editorWidget.background": popover,
        "editorWidget.foreground": foreground,
        "editorWidget.border": border,
        "editorWidget.resizeBorder": primary,
        "editorHoverWidget.background": popover,
        "editorHoverWidget.foreground": foreground,
        "editorHoverWidget.border": border,
        "editorHoverWidget.statusBarBackground": secondary,
        "editorSuggestWidget.background": popover,
        "editorSuggestWidget.foreground": foreground,
        "editorSuggestWidget.border": border,
        "editorSuggestWidget.highlightForeground": primary,
        "editorSuggestWidget.selectedBackground": accent,
        "editorSuggestWidget.selectedForeground": foreground,
        "editorSuggestWidget.focusHighlightForeground": primary,
        "editorLink.activeForeground": primary,
        "textLink.foreground": primary,
        "textLink.activeForeground": key,
        "textCodeBlock.background": muted,
        focusBorder: `${primary}80`,
        foreground: foreground,
        descriptionForeground: subtle,
        "icon.foreground": subtle,
        "widget.shadow": "#00000040",
        "input.background": background,
        "input.foreground": foreground,
        "input.border": input,
        "input.placeholderForeground": subtle,
        "inputOption.activeBackground": accent,
        "inputOption.activeBorder": `${primary}66`,
        "inputOption.activeForeground": primary,
        "inputOption.hoverBackground": secondary,
        "button.background": primary,
        "button.foreground": color("primary-foreground"),
        "button.hoverBackground": key,
        "list.hoverBackground": secondary,
        "list.hoverForeground": foreground,
        "list.focusBackground": accent,
        "list.focusForeground": foreground,
        "list.highlightForeground": primary,
        "list.activeSelectionBackground": accent,
        "list.activeSelectionForeground": foreground,
        "menu.background": popover,
        "menu.foreground": foreground,
        "menu.border": border,
        "menu.selectionBackground": accent,
        "menu.selectionForeground": foreground,
        "menu.separatorBackground": border,
        "scrollbar.shadow": "#00000000",
        "scrollbarSlider.background": `${input}66`,
        "scrollbarSlider.hoverBackground": `${subtle}40`,
        "scrollbarSlider.activeBackground": `${subtle}66`,
        "minimap.background": background,
        "minimap.selectionHighlight": `${primary}66`,
        "minimap.findMatchHighlight": `${warning}80`,
        "minimap.errorHighlight": danger,
        "minimap.warningHighlight": warning,
        "diffEditor.insertedLineBackground": `${success}14`,
        "diffEditor.insertedTextBackground": `${success}2b`,
        "diffEditor.removedLineBackground": `${danger}14`,
        "diffEditor.removedTextBackground": `${danger}2b`,
        "diffEditorGutter.insertedLineBackground": `${success}1f`,
        "diffEditorGutter.removedLineBackground": `${danger}1f`,
        "diffEditorOverview.insertedForeground": `${success}80`,
        "diffEditorOverview.removedForeground": `${danger}80`,
        "diffEditor.diagonalFill": border,
        "diffEditor.border": border,
        "diffEditor.unchangedRegionBackground": surface,
        "diffEditor.unchangedRegionForeground": subtle,
      },
    });
  } finally {
    probe.remove();
  }
}
