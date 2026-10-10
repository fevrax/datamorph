import React, {
  Children,
  createContext,
  useContext,
  useId,
  useState,
} from "react";
import {
  Dialog as DialogPrimitive,
  DropdownMenu as Menu,
  Popover as PopoverPrimitive,
  Tooltip as TooltipPrimitive,
  Switch as SwitchPrimitive,
  Checkbox as CheckboxPrimitive,
  Select as SelectPrimitive,
  RadioGroup as RadioPrimitive,
  Tabs as TabsPrimitive,
  Slider as SliderPrimitive,
} from "radix-ui";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "./utils";
export { cn } from "./utils";

type StyleProps = {
  classNames?: Record<string, string>;
  size?: string;
  radius?: string;
  color?: string;
  variant?: string;
  disableAnimation?: boolean;
};
const buttonVariants = cva(
  "ui-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-[length:var(--font-size-button,13px)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2 text-[length:var(--font-size-button,13px)]",
        lg: "h-9 px-4",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: { variant: "outline", size: "default" },
  },
);
export type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> &
  StyleProps & {
    onPress?: () => void;
    isIconOnly?: boolean;
    isDisabled?: boolean;
    isLoading?: boolean;
    startContent?: React.ReactNode;
    endContent?: React.ReactNode;
    disableRipple?: boolean;
    fullWidth?: boolean;
  };
export function Button({
  className,
  variant,
  color,
  size,
  radius: _radius,
  classNames: _classNames,
  onPress,
  onClick,
  isIconOnly,
  isDisabled,
  isLoading,
  startContent,
  endContent,
  disableRipple: _ripple,
  disableAnimation: _animation,
  fullWidth,
  children,
  ...props
}: ButtonProps) {
  const style =
    variant === "light" || variant === "ghost"
      ? "ghost"
      : color === "danger"
        ? "destructive"
        : variant === "flat" || variant === "faded"
          ? "secondary"
          : color === "primary" || variant === "default" || variant === "solid"
            ? "default"
            : "outline";
  return (
    <button
      type="button"
      {...props}
      disabled={isDisabled || isLoading || props.disabled}
      data-slot="button"
      className={cn(
        buttonVariants({
          variant: style,
          size: isIconOnly
            ? "icon"
            : size === "sm"
              ? "sm"
              : size === "lg"
                ? "lg"
                : "default",
        }),
        fullWidth && "w-full",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onPress?.();
      }}
    >
      {isLoading ? <LoaderCircle className="animate-spin" /> : startContent}
      {children}
      {endContent}
    </button>
  );
}
export function ButtonGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & StyleProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      {...domProps(props)}
    />
  );
}
function domProps<T extends Record<string, unknown>>(
  props: T,
): Record<string, unknown> {
  const omitted = new Set([
    "classNames",
    "size",
    "radius",
    "color",
    "variant",
    "shadow",
    "fullWidth",
    "disableAnimation",
    "disableRipple",
    "motionProps",
    "isBlurred",
    "isFooterBlurred",
  ]);
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => !omitted.has(key)),
  );
}
export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "color"
> &
  StyleProps & {
    label?: React.ReactNode;
    description?: React.ReactNode;
    errorMessage?: React.ReactNode;
    isInvalid?: boolean;
    isDisabled?: boolean;
    isRequired?: boolean;
    isReadOnly?: boolean;
    isClearable?: boolean;
    onClear?: () => void;
    onValueChange?: (value: string) => void;
    startContent?: React.ReactNode;
    endContent?: React.ReactNode;
    labelPlacement?: string;
    ref?: React.Ref<HTMLInputElement>;
  };
export function Input({
  label,
  description,
  errorMessage,
  isInvalid,
  isDisabled,
  isRequired,
  isReadOnly,
  isClearable,
  onClear,
  onValueChange,
  startContent,
  endContent,
  className,
  classNames,
  size: _s,
  color: _c,
  variant: _v,
  radius: _r,
  labelPlacement: _lp,
  onChange,
  ...props
}: InputProps) {
  const generated = useId();
  const id = props.id || generated;
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex min-h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring/40",
          isInvalid && "border-destructive",
          classNames?.inputWrapper,
        )}
      >
        {startContent}
        <input
          {...props}
          id={id}
          disabled={isDisabled || props.disabled}
          required={isRequired || props.required}
          readOnly={isReadOnly || props.readOnly}
          aria-invalid={isInvalid}
          className={cn(
            "w-full min-w-0 bg-transparent py-1.5 text-[13px] outline-none placeholder:text-muted-foreground disabled:opacity-50",
            classNames?.input,
          )}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
        />
        {isClearable && props.value && (
          <button
            type="button"
            aria-label="清空输入"
            onClick={() => {
              onClear?.();
              onValueChange?.("");
            }}
          >
            <X className="size-3.5" />
          </button>
        )}
        {endContent}
      </div>
      {(isInvalid ? errorMessage : description) && (
        <div
          className={cn(
            "text-xs",
            isInvalid ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {isInvalid ? errorMessage : description}
        </div>
      )}
    </div>
  );
}
export type TextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "color"
> &
  StyleProps & {
    label?: React.ReactNode;
    onValueChange?: (value: string) => void;
    isDisabled?: boolean;
    isReadOnly?: boolean;
    isInvalid?: boolean;
    errorMessage?: React.ReactNode;
    minRows?: number;
    maxRows?: number;
    labelPlacement?: string;
  };
export function Textarea({
  className,
  classNames: _cn,
  label,
  onValueChange,
  onChange,
  isDisabled,
  isReadOnly,
  isInvalid,
  errorMessage,
  minRows,
  maxRows: _max,
  size: _s,
  color: _c,
  variant: _v,
  radius: _r,
  labelPlacement: _lp,
  ...props
}: TextareaProps) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && <label htmlFor={props.id || id}>{label}</label>}
      <textarea
        {...props}
        id={props.id || id}
        rows={minRows || props.rows || 3}
        disabled={isDisabled || props.disabled}
        readOnly={isReadOnly || props.readOnly}
        aria-invalid={isInvalid}
        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
      />
      {isInvalid && (
        <span className="text-xs text-destructive">{errorMessage}</span>
      )}
    </div>
  );
}
export function Chip({
  className,
  children,
  startContent,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  StyleProps & { startContent?: React.ReactNode }) {
  return (
    <span
      {...domProps(props)}
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground",
        className,
      )}
    >
      {startContent}
      {children}
    </span>
  );
}
export function Card({
  className,
  children,
  isPressable,
  onPress,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  StyleProps & {
    isPressable?: boolean;
    onPress?: () => void;
    shadow?: string;
  }) {
  return (
    <div
      {...domProps(props)}
      role={isPressable ? "button" : props.role}
      tabIndex={isPressable ? 0 : props.tabIndex}
      onClick={onPress || props.onClick}
      onKeyDown={(e) => {
        if (isPressable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onPress?.();
        }
        props.onKeyDown?.(e);
      }}
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        isPressable &&
          "cursor-pointer hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </div>
  );
}
export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
export const CardContent = CardBody;
export const CardHeader = CardBody;
export const CardFooter = CardBody;
export function Divider({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: string;
}) {
  return (
    <div
      role="separator"
      className={cn(
        "bg-border",
        orientation === "vertical" ? "w-px self-stretch" : "h-px w-full",
        className,
      )}
    />
  );
}
export function Spinner({
  className,
  label,
  ...props
}: {
  className?: string;
  label?: string;
  size?: string;
  color?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label || "加载中"}
      className={cn(
        "inline-flex items-center gap-2 text-muted-foreground",
        className,
      )}
    >
      <LoaderCircle
        className={cn(
          "animate-spin",
          props.size === "sm" ? "size-4" : "size-5",
        )}
      />
      {label}
    </span>
  );
}
export function Avatar({
  src,
  name,
  className,
}: {
  src?: string;
  name?: string;
  className?: string;
  size?: string;
}) {
  return src ? (
    <img
      alt={name || "头像"}
      src={src}
      className={cn("size-7 rounded-full", className)}
    />
  ) : (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-secondary text-xs",
        className,
      )}
    >
      {name?.slice(0, 1) || "AI"}
    </span>
  );
}
export function Tooltip({
  children,
  content,
  delay = 350,
  placement = "top",
  isDisabled,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  delay?: number;
  closeDelay?: number;
  placement?: string;
  isDisabled?: boolean;
  className?: string;
  color?: string;
  classNames?: Record<string, string>;
}) {
  if (isDisabled || !content) return children;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={placement.split("-")[0] as "top" | "bottom" | "left" | "right"}
          sideOffset={6}
          className="z-[150] max-w-80 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
export function useDisclosure() {
  const [isOpen, setOpen] = useState(false);
  return {
    isOpen,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onOpenChange: (open?: boolean) => setOpen((v) => open ?? !v),
  };
}
const ModalContext = createContext({
  close: () => {},
  className: "",
  size: "",
  titleId: "",
});
export type ModalProps = {
  children?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  className?: string;
  classNames?: Record<string, string>;
  size?: string;
  scrollBehavior?: string;
  placement?: string;
  backdrop?: string;
  motionProps?: unknown;
  hideCloseButton?: boolean;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  radius?: string;
  style?: React.CSSProperties;
};
export function Modal({
  isOpen,
  onOpenChange,
  onClose,
  children,
  className,
  classNames,
  size = "lg",
}: ModalProps) {
  const titleId = useId();
  const close = () => {
    onOpenChange?.(false);
    onClose?.();
  };
  return (
    <ModalContext.Provider
      value={{
        close,
        className: cn(className, classNames?.base),
        size,
        titleId,
      }}
    >
      <DialogPrimitive.Root
        open={isOpen}
        onOpenChange={(open) => {
          onOpenChange?.(open);
          if (!open) onClose?.();
        }}
      >
        {children}
      </DialogPrimitive.Root>
    </ModalContext.Provider>
  );
}
export function ModalContent({
  children,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  children?: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const modal = useContext(ModalContext);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/35 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        {...props}
        aria-labelledby={modal.titleId}
        aria-describedby={undefined}
        className={cn(
          "fixed left-1/2 top-1/2 z-[101] flex max-h-[88dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
          modal.size === "5xl"
            ? "max-w-5xl"
            : modal.size === "3xl"
              ? "max-w-3xl"
              : modal.size === "2xl"
                ? "max-w-2xl"
                : "max-w-lg",
          modal.className,
          className,
        )}
      >
        {typeof children === "function" ? children(modal.close) : children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="关闭"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export function ModalHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const modal = useContext(ModalContext);
  return (
    <DialogPrimitive.Title asChild id={modal.titleId}>
      <div
        className={cn(
          "px-5 pb-3 pt-5 pr-10 text-base font-semibold",
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Title>
  );
}
export function ModalBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-h-0 overflow-y-auto px-5 py-2", className)}
      {...props}
    />
  );
}
export function ModalFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-2 px-5 py-4", className)}
      {...props}
    />
  );
}
export function Popover({
  children,
  isOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: string;
  showArrow?: boolean;
  offset?: number;
  classNames?: Record<string, string>;
}) {
  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      {children}
    </PopoverPrimitive.Root>
  );
}
export function PopoverTrigger({ children }: { children: React.ReactNode }) {
  return (
    <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
  );
}
export function PopoverContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={6}
        align="end"
        className={cn(
          "z-[110] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
export function Dropdown({
  children,
  isOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: string;
  radius?: string;
  classNames?: Record<string, string>;
}) {
  return (
    <Menu.Root open={isOpen} onOpenChange={onOpenChange}>
      {children}
    </Menu.Root>
  );
}
export function DropdownTrigger({
  children,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <Menu.Trigger asChild {...props}>
      {children}
    </Menu.Trigger>
  );
}
export function DropdownMenu({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: string;
  disabledKeys?: Iterable<React.Key>;
}) {
  return (
    <Menu.Portal>
      <Menu.Content
        {...domProps(props)}
        align="end"
        sideOffset={5}
        className={cn(
          "z-[120] min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg",
          className,
        )}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}
export function DropdownItem({
  children,
  className,
  startContent,
  endContent,
  onPress,
  onClick,
  isDisabled,
  description,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> &
  StyleProps & {
    onPress?: () => void;
    onClick?: () => void;
    startContent?: React.ReactNode;
    endContent?: React.ReactNode;
    isDisabled?: boolean;
    description?: React.ReactNode;
    showDivider?: boolean;
    shortcut?: string;
    textValue?: string;
  }) {
  return (
    <Menu.Item
      disabled={isDisabled}
      onSelect={() => {
        onPress?.();
        onClick?.();
      }}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...domProps(
        Object.fromEntries(
          Object.entries(props).filter(
            ([k]) => !["showDivider", "shortcut", "textValue"].includes(k),
          ),
        ),
      )}
    >
      {startContent}
      <span className="flex-1">
        {children}
        {description && (
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {endContent}
    </Menu.Item>
  );
}
export function Switch({
  isSelected,
  onValueChange,
  onChange,
  isDisabled,
  children,
  className,
  ...props
}: StyleProps & {
  isSelected?: boolean;
  onValueChange?: (value: boolean) => void;
  onChange?: () => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  return (
    <label
      className={cn("inline-flex items-center gap-2 text-[13px]", className)}
      htmlFor={props.id || id}
    >
      <SwitchPrimitive.Root
        id={props.id || id}
        checked={isSelected}
        onCheckedChange={(v) => {
          onValueChange?.(v);
          onChange?.();
        }}
        disabled={isDisabled}
        aria-label={props["aria-label"]}
        className="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors data-[state=checked]:bg-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
      >
        <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" />
      </SwitchPrimitive.Root>
      {children}
    </label>
  );
}
export function Checkbox({
  isSelected,
  isIndeterminate,
  onValueChange,
  children,
  className,
  isDisabled,
  ...props
}: StyleProps & {
  isSelected?: boolean;
  isIndeterminate?: boolean;
  onValueChange?: (value: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  isDisabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2 text-[13px]", className)}>
      <CheckboxPrimitive.Root
        aria-label={props["aria-label"]}
        checked={isIndeterminate ? "indeterminate" : isSelected}
        disabled={isDisabled}
        onCheckedChange={(v) => onValueChange?.(v === true)}
        className="flex size-4 shrink-0 items-center justify-center rounded border border-input data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {children}
    </label>
  );
}
type ItemProps = {
  children?: React.ReactNode;
  startContent?: React.ReactNode;
  description?: React.ReactNode;
  textValue?: string;
  className?: string;
  "aria-label"?: string;
};
export function SelectItem(_props: ItemProps) {
  return null;
}
export function Select({
  children,
  selectedKeys,
  onChange,
  onSelectionChange,
  label,
  className,
  placeholder,
  isDisabled,
  startContent,
  ...props
}: StyleProps & {
  children: React.ReactNode;
  selectedKeys?: Iterable<React.Key>;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onSelectionChange?: (keys: Set<React.Key>) => void;
  label?: React.ReactNode;
  className?: string;
  placeholder?: string;
  isDisabled?: boolean;
  startContent?: React.ReactNode;
  selectionMode?: string;
  disallowEmptySelection?: boolean;
  "aria-label"?: string;
  id?: string;
}) {
  const selected = Array.from(selectedKeys || [])[0]?.toString();
  const id = useId();
  const items: React.ReactElement<ItemProps>[] = [];
  Children.forEach(children, (c) => {
    if (React.isValidElement<ItemProps>(c)) items.push(c);
  });
  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      {label && (
        <label htmlFor={props.id || id} className="text-xs font-medium">
          {label}
        </label>
      )}
      <SelectPrimitive.Root
        value={selected || undefined}
        disabled={isDisabled}
        onValueChange={(value) => {
          onSelectionChange?.(new Set([value]));
          onChange?.({
            target: { value },
            currentTarget: { value },
          } as React.ChangeEvent<HTMLSelectElement>);
        }}
      >
        <SelectPrimitive.Trigger
          id={props.id || id}
          aria-label={props["aria-label"]}
          className="flex min-h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1 text-[13px] focus-visible:ring-2 focus-visible:ring-ring"
        >
          {startContent}
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="ml-auto">
            <ChevronDown className="size-3.5" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-[130] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <SelectPrimitive.Viewport>
              {items.map((item) => (
                <SelectPrimitive.Item
                  key={item.key}
                  value={String(item.key)}
                  className="relative flex cursor-default items-center gap-2 rounded px-2 py-1.5 pr-7 text-[13px] outline-none focus:bg-accent"
                >
                  {item.props.startContent}
                  <SelectPrimitive.ItemText>
                    {item.props.children}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2">
                    <Check className="size-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
export function Slider({
  value,
  onChange,
  minValue = 0,
  maxValue = 100,
  className,
  step = 1,
  ...props
}: StyleProps & {
  value: number | number[];
  onChange?: (value: number | number[]) => void;
  minValue?: number;
  maxValue?: number;
  className?: string;
  step?: number;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-8 w-full touch-none items-center",
        className,
      )}
      min={minValue}
      max={maxValue}
      step={step}
      value={Array.isArray(value) ? value : [value]}
      onValueChange={(v) => onChange?.(Array.isArray(value) ? v : v[0])}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={props["aria-label"]}
        className="block size-4 rounded-full border border-primary bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
    </SliderPrimitive.Root>
  );
}
export function RadioGroup({
  children,
  value,
  onValueChange,
  className,
  orientation,
  ...props
}: StyleProps & {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  orientation?: string;
  label?: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <RadioPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={props["aria-label"]}
      className={cn(
        "flex gap-3",
        orientation === "horizontal" ? "flex-row" : "flex-col",
        className,
      )}
    >
      {children}
    </RadioPrimitive.Root>
  );
}
export function Radio({
  value,
  children,
  className,
  description,
}: StyleProps & {
  value: string;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2", className)}>
      <RadioPrimitive.Item
        value={value}
        className="flex size-4 items-center justify-center rounded-full border border-input"
      >
        <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary" />
      </RadioPrimitive.Item>
      <span>
        {children}
        {description && (
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
export function Tab(_props: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return null;
}
export function Tabs({
  children,
  selectedKey,
  onSelectionChange,
  className,
  classNames,
  disabledKeys,
  style,
  ref: _ref,
  ...props
}: StyleProps & {
  children: React.ReactNode;
  selectedKey?: React.Key;
  onSelectionChange?: (key: React.Key) => void;
  className?: string;
  disabledKeys?: Iterable<React.Key>;
  style?: React.CSSProperties;
  ref?: React.Ref<unknown>;
  "aria-label"?: string;
}) {
  const items: React.ReactElement<{
    title: React.ReactNode;
    children?: React.ReactNode;
  }>[] = [];
  Children.forEach(children, (c) => {
    if (
      React.isValidElement<{
        title: React.ReactNode;
        children?: React.ReactNode;
      }>(c)
    )
      items.push(c);
  });
  return (
    <TabsPrimitive.Root
      value={String(selectedKey)}
      onValueChange={onSelectionChange}
      className={className}
      style={style}
    >
      <TabsPrimitive.List
        aria-label={props["aria-label"]}
        className={cn("flex items-center gap-1", classNames?.tabList)}
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.key}
            value={String(item.key)}
            disabled={Array.from(disabledKeys || []).includes(item.key || "")}
            className={cn(
              "relative border-b-2 border-transparent px-3 py-2 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground",
              classNames?.tab,
            )}
          >
            {item.props.title}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) =>
        item.props.children ? (
          <TabsPrimitive.Content key={item.key} value={String(item.key)}>
            {item.props.children}
          </TabsPrimitive.Content>
        ) : null,
      )}
    </TabsPrimitive.Root>
  );
}
