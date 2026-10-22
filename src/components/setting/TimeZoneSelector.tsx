import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Globe2, Search } from "lucide-react";
import {
  cn,
  Modal,
  ModalContent,
  ModalHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  getLocalTimeZone,
  getTimeZoneLabel,
  getTimeZones,
  LOCAL_TIME_ZONE,
  OPEN_TIME_ZONE_EVENT,
  resolveTimeZone,
} from "@/utils/timeZone";

function TimeZoneList({ onSelect }: { onSelect: () => void }) {
  const value = useSettingsStore((s) => s.timestampTimeZone);
  const setTimeZone = useSettingsStore((s) => s.setTimestampTimeZone);
  const zones = useMemo(
    () => Array.from(new Set([LOCAL_TIME_ZONE, value, ...getTimeZones()])),
    [value],
  );
  return (
    <Command
      label="选择时间戳时区"
      filter={(value, search, keywords) => {
        const normalize = (text: string) =>
          text.toLowerCase().replace(/_/g, " ");
        return normalize(`${value} ${keywords?.join(" ") || ""}`).includes(
          normalize(search.trim()),
        )
          ? 1
          : 0;
      }}
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <Command.Input
          aria-label="搜索时区"
          placeholder="搜索城市或时区…"
          className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-[min(300px,45dvh)] overflow-y-auto overscroll-contain p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
          未找到时区，请尝试城市英文名
        </Command.Empty>
        {zones.map((zone) => (
          <Command.Item
            key={zone}
            value={zone}
            keywords={[
              getTimeZoneLabel(zone),
              zone === LOCAL_TIME_ZONE ? getLocalTimeZone() : "",
            ]}
            onSelect={() => {
              setTimeZone(zone);
              onSelect();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[13px] outline-none data-[selected=true]:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate">{getTimeZoneLabel(zone)}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {zone === LOCAL_TIME_ZONE ? getLocalTimeZone() : zone}
              </div>
            </div>
            {value === zone && (
              <Check
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  );
}

export function TimeZoneSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const value = useSettingsStore((s) => s.timestampTimeZone);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          aria-label="时间戳时区"
          title={resolveTimeZone(value)}
          className={cn(
            "flex min-h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Globe2
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">
            {getTimeZoneLabel(value)}
          </span>
          <ChevronsUpDown
            className="size-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="选择时间戳时区"
        collisionPadding={12}
        className="z-[140] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden p-0"
      >
        <TimeZoneList onSelect={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** The hover command also works in editors without a settings toolbar. */
export function TimeZoneDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_TIME_ZONE_EVENT, show);
    return () => window.removeEventListener(OPEN_TIME_ZONE_EVENT, show);
  }, []);
  return (
    <Modal isOpen={open} onClose={() => setOpen(false)}>
      <ModalContent className="max-w-sm">
        <ModalHeader>时间戳时区</ModalHeader>
        <p className="px-5 pb-3 text-xs text-muted-foreground">
          选择后立即应用于所有编辑器，也可在系统设置中更改。
        </p>
        <TimeZoneList onSelect={() => setOpen(false)} />
      </ModalContent>
    </Modal>
  );
}
