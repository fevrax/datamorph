import { createContext, useContext, type RefObject } from "react";
import { Menu, Search } from "lucide-react";

interface WorkspaceActions {
  openSearch: () => void;
  openNavigation: () => void;
  navigationOpen: boolean;
  navigationTrigger: RefObject<HTMLButtonElement | null>;
}

export const WorkspaceActionsContext = createContext<WorkspaceActions | null>(
  null,
);

export function WorkspaceSearchTrigger({
  compact = false,
}: {
  compact?: boolean;
}) {
  const actions = useContext(WorkspaceActionsContext);
  if (!actions) return null;
  return (
    <button
      type="button"
      className={`command-trigger${compact ? " command-trigger-compact" : ""}`}
      aria-label="搜索标签与操作"
      aria-haspopup="dialog"
      title="搜索标签与操作（⌘ / Ctrl K）"
      onClick={actions.openSearch}
    >
      <Search className="size-3.5 shrink-0" />
      <span>搜索标签与操作</span>
      <kbd>⌘ K</kbd>
    </button>
  );
}

export function WorkspaceNavigationTrigger() {
  const actions = useContext(WorkspaceActionsContext);
  if (!actions) return null;
  return (
    <button
      type="button"
      ref={actions.navigationTrigger}
      className="mobile-nav-toggle nav-icon-button"
      aria-label="打开导航"
      aria-expanded={actions.navigationOpen}
      aria-controls="workspace-navigation"
      onClick={actions.openNavigation}
    >
      <Menu />
    </button>
  );
}
