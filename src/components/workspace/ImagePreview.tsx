import { useTabStore } from "@/store/useTabStore";
import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@/components/ui";
import clipboard from "@/utils/clipboard";
export function ImagePreview() {
  const activeKey = useTabStore(
    (s) => s.activeTabKey + ":" + s.getTabByKey(s.activeTabKey)?.view,
  );
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => setUrl(""), [activeKey]);
  useEffect(() => {
    const open = (event: Event) => {
      setFailed(false);
      setUrl((event as CustomEvent<string>).detail);
    };
    window.addEventListener("json-tools:preview-image", open);
    return () => window.removeEventListener("json-tools:preview-image", open);
  }, []);
  return (
    <Modal isOpen={!!url} onClose={() => setUrl("")} size="3xl">
      <ModalContent>
        <ModalHeader>图片预览</ModalHeader>
        <ModalBody>
          {url &&
            (failed ? (
              <div className="py-12 text-center text-muted-foreground">
                无法加载图片，请检查地址或在浏览器中打开。
              </div>
            ) : (
              <img
                src={url}
                alt="JSON 中引用的图片"
                className="mx-auto max-h-[60dvh] object-contain"
                onError={() => setFailed(true)}
              />
            ))}
          <p className="mt-3 break-all text-xs text-muted-foreground">{url}</p>
        </ModalBody>
        <ModalFooter>
          <Button onPress={() => void clipboard.copy(url, "已复制图片地址")}>
            复制地址
          </Button>
          <Button
            onPress={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            在浏览器打开
          </Button>
          <Button color="primary" onPress={() => setUrl("")}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
