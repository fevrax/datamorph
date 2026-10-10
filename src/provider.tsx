import { ImagePreview } from "@/components/workspace/ImagePreview";
import { ThemeProvider } from "next-themes";
import { Tooltip } from "radix-ui";
import { Toaster } from "sonner";
export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Tooltip.Provider delayDuration={350}>
        {children}
        <ImagePreview />
        <Toaster
          position="bottom-right"
          closeButton
          richColors
          visibleToasts={3}
        />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}
