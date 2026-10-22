import { encodeJwtLossless, decodeJwtLossless } from "@/utils/jwtLossless";
import { writeClipboardText } from "@/utils/clipboard";
import { createToolStateHook } from "@/components/workspace/ToolContext";
import { useRef, useState } from "react";
import {
  Button,
  Spinner,
  Select,
  SelectItem,
  Tooltip,
  Input,
} from "@/components/ui";
import {
  Copy,
  CircleHelp,
  KeyRound,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import ToolPanel from "@/components/toolbox/ToolPanel";
import toast from "@/utils/toast";
import { useTheme } from "next-themes";
import jwt from "jsonwebtoken";

import MonacoEditor, {
  MonacoDataEditorRef,
} from "@/components/monacoEditor/MonacoDataEditor.tsx";
import ToolboxPageTemplate from "@/layouts/toolboxPageTemplate";
import { parseJson, stringifyJson } from "@/utils/json";

interface JwtPayload {
  exp?: number;
  nbf?: number;
  [key: string]: any;
}

// JWT 编码函数
const encodeJwt = async (
  header: object,
  payload: object,
  secret: string,
  algorithm: string,
) => {
  try {
    // 确保 header 中的 alg 与选择的算法一致，但保留其他自定义字段
    const updatedHeader: Record<string, any> = { ...header, alg: algorithm };

    // 如果没有指定typ，添加默认的JWT类型
    if (!("typ" in updatedHeader)) {
      updatedHeader.typ = "JWT";
    }

    // 检查payload是否有效
    if (!payload || typeof payload !== "object") {
      throw new Error("无效的payload格式");
    }

    const token = encodeJwtLossless(updatedHeader, payload, secret, algorithm);

    return token;
  } catch (error) {
    console.error("JWT 编码错误:", error);
    throw error;
  }
};

// JWT 解码函数
const decodeJwt = (token: string) => {
  try {
    if (!token || token.trim() === "") {
      return {
        header: null,
        payload: null,
        isValid: false,
        error: "空JWT令牌",
      };
    }

    // 分割 JWT 令牌
    const parts = token.split(".");

    if (parts.length !== 3) {
      return {
        header: null,
        payload: null,
        isValid: false,
        error: "无效的JWT格式，应包含三个部分",
      };
    }

    const decoded = decodeJwtLossless(token);

    if (!decoded) {
      return {
        header: null,
        payload: null,
        isValid: false,
        error: "JWT解析失败",
      };
    }

    return {
      header: decoded.header,
      payload: decoded.payload,
      isValid: true,
      error: null,
    };
  } catch (error) {
    console.error("JWT 解析错误:", error);

    return {
      header: null,
      payload: null,
      isValid: false,
      error: "JWT解析失败",
    };
  }
};

// 验证 JWT 签名
const verifyJwtSignature = async (token: string, secret: string) => {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return { isValid: false, message: "无效的JWT格式，应包含三个部分" };
    }

    // 解码以获取头部信息和算法
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || !decoded.header) {
      return { isValid: false, message: "无效的JWT格式" };
    }

    const algorithm = decoded.header.alg;

    // 支持的算法
    const supportedAlgs = [
      "HS256",
      "HS384",
      "HS512",
      "RS256",
      "RS384",
      "RS512",
      "ES256",
      "ES384",
      "ES512",
      "PS256",
      "PS384",
      "PS512",
    ];

    if (!supportedAlgs.includes(algorithm)) {
      return {
        isValid: false,
        message: `不支持的算法: ${algorithm}，支持的算法: ${supportedAlgs.join(", ")}`,
      };
    }

    // 检查非对称算法的密钥格式
    const isAsymmetricAlg = [
      "RS256",
      "RS384",
      "RS512",
      "ES256",
      "ES384",
      "ES512",
      "PS256",
      "PS384",
      "PS512",
    ].includes(algorithm);

    if (isAsymmetricAlg && !secret.includes("-----BEGIN")) {
      return {
        isValid: false,
        message: "非对称算法验证需要有效的密钥格式，如 PEM 格式",
      };
    }

    try {
      // 使用 jsonwebtoken 验证令牌
      const verified = jwt.verify(token, secret, {
        algorithms: [algorithm as jwt.Algorithm],
      });

      // 验证时间相关的字段
      const payload = verified as JwtPayload;
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && now > payload.exp) {
        return { isValid: false, message: "JWT已过期", algorithm };
      }

      if (payload.nbf && now < payload.nbf) {
        return { isValid: false, message: "JWT尚未生效", algorithm };
      }

      return {
        isValid: true,
        message: `JWT签名有效${payload?.exp ? "、时间有效" : ""}. 算法是: ${algorithm}`,
        algorithm,
      };
    } catch (err) {
      // 根据错误消息判断错误类型，而不是使用instanceof
      const errorMessage = (err as Error).message || "";

      if (errorMessage.includes("invalid signature")) {
        return { isValid: false, message: "JWT签名验证失败", algorithm };
      } else if (errorMessage.includes("jwt expired")) {
        return { isValid: false, message: "JWT已过期", algorithm };
      } else if (errorMessage.includes("not active")) {
        return { isValid: false, message: "JWT尚未生效", algorithm };
      } else {
        return {
          isValid: false,
          message: `验证失败: ${errorMessage}`,
          algorithm,
        };
      }
    }
  } catch (error) {
    console.error("验证错误:", error);

    return { isValid: false, message: `验证失败: ${(error as Error).message}` };
  }
};

const useToolState = createToolStateHook("jwtParse");

export default function JwtParsePage() {
  const { resolvedTheme: theme } = useTheme();

  // 编辑器引用
  const jwtEditorRef = useRef<MonacoDataEditorRef>(null);
  const headerEditorRef = useRef<MonacoDataEditorRef>(null);
  const payloadEditorRef = useRef<MonacoDataEditorRef>(null);
  const encodeHeaderEditorRef = useRef<MonacoDataEditorRef>(null);
  const encodePayloadEditorRef = useRef<MonacoDataEditorRef>(null);

  // 状态管理
  const [jwtToken, setJwtToken] = useToolState("jwtToken", "");
  const [headerJson, setHeaderJson] = useToolState("headerJson", "");
  const [payloadJson, setPayloadJson] = useToolState("payloadJson", "");
  const [encodeHeaderJson, setEncodeHeaderJson] = useToolState(
    "encodeHeaderJson",
    stringifyJson({ alg: "HS256", typ: "JWT" }, 2),
  );
  const [encodePayloadJson, setEncodePayloadJson] = useToolState(
    "encodePayloadJson",
    stringifyJson(
      {
        sub: "1234567890",
        name: "示例用户",
        iat: Math.floor(Date.now() / 1000),
      },
      2,
    ),
  );
  const [secret, setSecret] = useToolState("secret", "");
  const [isTokenValid, setIsTokenValid] = useToolState("isTokenValid", null);
  const [validationMessage, setValidationMessage] = useToolState(
    "validationMessage",
    "",
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useToolState(
    "selectedAlgorithm",
    "HS256",
  );

  // 解析 JWT
  const parseJwt = () => {
    if (!jwtToken) {
      setIsTokenValid(false);
      setValidationMessage("请输入 JWT 令牌");

      return;
    }

    setIsProcessing(true);

    try {
      const { header, payload, isValid, error } = decodeJwt(jwtToken);

      if (!isValid || !header || !payload) {
        setIsTokenValid(false);
        setValidationMessage(error || "无效的 JWT 格式");
        setIsProcessing(false);

        return;
      }

      // 更新编辑器内容
      const formattedHeader = stringifyJson(header, 2);
      const formattedPayload = stringifyJson(payload, 2);

      setHeaderJson(formattedHeader);
      setPayloadJson(formattedPayload);

      headerEditorRef.current?.updateValue(formattedHeader);
      payloadEditorRef.current?.updateValue(formattedPayload);

      // 设置为警告状态
      setIsTokenValid(null);
      setValidationMessage(
        "JWT 格式有效，这似乎是一个正确签名的JWT，需进一步校验。",
      );
    } catch (error) {
      // 安全地获取错误消息
      const errorMsg =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "未知错误";

      console.error("解析错误:", error);
      setIsTokenValid(false);
      setValidationMessage(`解析失败: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 验证 JWT
  const verifyJwt = async () => {
    if (!jwtToken) {
      setIsTokenValid(false);
      setValidationMessage("请输入 JWT 令牌");

      return;
    }

    if (!secret) {
      setIsTokenValid(false);
      setValidationMessage("请输入密钥");

      return;
    }

    setIsProcessing(true);

    try {
      // 检查令牌格式
      const parts = jwtToken.split(".");

      if (parts.length !== 3) {
        setIsTokenValid(false);
        setValidationMessage("无效的JWT格式，应包含三个部分");

        return;
      }

      // 解析头部获取算法
      const decoded = jwt.decode(jwtToken, { complete: true });

      if (!decoded || !decoded.header || !decoded.header.alg) {
        setIsTokenValid(false);
        setValidationMessage("无法解析JWT头部");

        return;
      }

      const result = await verifyJwtSignature(jwtToken, secret);

      setIsTokenValid(result.isValid);
      setValidationMessage(result.message);
    } catch (error) {
      // 安全地获取错误消息
      const errorMsg =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "未知错误";

      console.error("验证错误:", error);
      setIsTokenValid(false);
      setValidationMessage(`验证失败: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 编码 JWT
  const encodeJwtToken = async () => {
    if (!secret) {
      setIsTokenValid(false);
      setValidationMessage("请输入密钥");

      return;
    }

    setIsProcessing(true);

    try {
      // 检查解码区域是否有内容，如果有，优先使用解码区域的内容进行编码
      let useHeaderJson = encodeHeaderJson;
      let usePayloadJson = encodePayloadJson;

      // 如果解码区域有内容，优先使用解码区域的内容
      if (headerJson && payloadJson) {
        useHeaderJson = headerJson;
        usePayloadJson = payloadJson;

        // 更新编码区域的内容，保持UI一致性
        setEncodeHeaderJson(headerJson);
        setEncodePayloadJson(payloadJson);
        encodeHeaderEditorRef.current?.updateValue(headerJson);
        encodePayloadEditorRef.current?.updateValue(payloadJson);
      }

      // 解析 header 和 payload
      let header, payload;

      try {
        header = parseJson(useHeaderJson);
        payload = parseJson(usePayloadJson);
      } catch (e) {
        const errorMsg =
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "未知错误";

        setIsTokenValid(false);
        setValidationMessage(`无效的 JSON 格式: ${errorMsg}`);
        setIsProcessing(false);

        return;
      }

      // 确保 header 中的 alg 与选择的算法一致
      header.alg = selectedAlgorithm;

      // 检查算法类型是否匹配密钥类型
      const isAsymmetricAlg = [
        "RS256",
        "RS384",
        "RS512",
        "ES256",
        "ES384",
        "ES512",
        "PS256",
        "PS384",
        "PS512",
      ].includes(selectedAlgorithm);

      // 检查非对称算法的私钥是否合法
      if (isAsymmetricAlg) {
        // 简单检查私钥格式，对于非对称算法，密钥通常是PEM格式
        if (!secret.includes("-----BEGIN") || !secret.includes("KEY-----")) {
          setIsTokenValid(false);
          setValidationMessage("非对称算法需要有效的私钥格式，如 PEM 格式");
          setIsProcessing(false);

          return;
        }
      }

      try {
        // 生成 JWT
        const token = await encodeJwt(
          header,
          payload,
          secret,
          selectedAlgorithm,
        );

        // 更新界面
        setJwtToken(token);
        jwtEditorRef.current?.updateValue(token);

        // 自动解析新生成的 token
        setIsTokenValid(true);
        setValidationMessage("JWT 生成成功");

        // 自动解析
        const { header: parsedHeader, payload: parsedPayload } =
          decodeJwt(token);

        if (parsedHeader && parsedPayload) {
          // 更新编辑器内容
          const formattedHeader = stringifyJson(parsedHeader, 2);
          const formattedPayload = stringifyJson(parsedPayload, 2);

          setHeaderJson(formattedHeader);
          setPayloadJson(formattedPayload);

          headerEditorRef.current?.updateValue(formattedHeader);
          payloadEditorRef.current?.updateValue(formattedPayload);
        }
      } catch (err) {
        // 安全地获取错误消息
        const errMsg =
          err && typeof err === "object" && "message" in err
            ? String(err.message)
            : "未知错误";

        if (isAsymmetricAlg && errMsg.includes("key")) {
          setIsTokenValid(false);
          setValidationMessage(
            `编码失败: 非对称算法需要有效的私钥格式，如 PEM 格式`,
          );
        } else {
          setIsTokenValid(false);
          setValidationMessage(`编码失败: ${errMsg}`);
        }
      }
    } catch (error) {
      // 安全地获取错误消息
      const errorMsg =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "未知错误";

      console.error("编码错误:", error);
      setIsTokenValid(false);
      setValidationMessage(`编码失败: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 重置函数
  const handleReset = () => {
    setJwtToken("");
    setHeaderJson("");
    setPayloadJson("");
    setSecret("");
    setIsTokenValid(null);
    setValidationMessage("");
    jwtEditorRef.current?.updateValue("");
    headerEditorRef.current?.updateValue("");
    payloadEditorRef.current?.updateValue("");

    // 重置编码区域为默认值
    const defaultHeader = stringifyJson(
      { alg: selectedAlgorithm, typ: "JWT" },
      2,
    );
    const defaultPayload = stringifyJson(
      {
        sub: "1234567890",
        name: "示例用户",
        iat: Math.floor(Date.now() / 1000),
      },
      2,
    );

    setEncodeHeaderJson(defaultHeader);
    setEncodePayloadJson(defaultPayload);
    encodeHeaderEditorRef.current?.updateValue(defaultHeader);
    encodePayloadEditorRef.current?.updateValue(defaultPayload);

    setIsTokenValid(true);
    setValidationMessage("内容已清空");
  };

  // 复制 JWT
  const copyJwt = () => {
    if (!jwtToken) {
      setIsTokenValid(false);
      setValidationMessage("暂无内容可复制");

      return;
    }

    if (navigator.clipboard || (window as any).utools) {
      writeClipboardText(jwtToken)
        .then(() => {
          setIsTokenValid(true);
          setValidationMessage("已复制到剪贴板");
        })
        .catch(() => {
          setIsTokenValid(false);
          setValidationMessage("复制失败");
        });
    } else {
      setIsTokenValid(false);
      setValidationMessage("复制失败");
    }
  };

  // 随机示例 JWT
  const generateSampleJwt = () => {
    // 设置示例header和payload
    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    // 使用当前时间戳作为iat，确保每次生成的JWT都不同
    const payload = {
      username: "datamorph",
      sub: "demo",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30天后过期
    };

    // 设置密钥
    const sampleSecret = "datamorph";

    setSecret(sampleSecret);

    // 更新编辑器内容
    const headerStr = stringifyJson(header, 2);
    const payloadStr = stringifyJson(payload, 2);

    setEncodeHeaderJson(headerStr);
    setEncodePayloadJson(payloadStr);
    encodeHeaderEditorRef.current?.updateValue(headerStr);
    encodePayloadEditorRef.current?.updateValue(payloadStr);

    // 生成JWT
    encodeJwt(header, payload, sampleSecret, "HS256")
      .then((token) => {
        setJwtToken(token);
        jwtEditorRef.current?.updateValue(token);

        // 解析生成的JWT
        const { header: parsedHeader, payload: parsedPayload } =
          decodeJwt(token);

        if (parsedHeader && parsedPayload) {
          const formattedHeader = stringifyJson(parsedHeader, 2);
          const formattedPayload = stringifyJson(parsedPayload, 2);

          setHeaderJson(formattedHeader);
          setPayloadJson(formattedPayload);

          headerEditorRef.current?.updateValue(formattedHeader);
          payloadEditorRef.current?.updateValue(formattedPayload);
        }

        setIsTokenValid(true);
        setValidationMessage("已生成新的示例 JWT");
      })
      .catch((error) => {
        console.error("生成示例JWT失败:", error);
        setIsTokenValid(false);
        setValidationMessage("生成示例JWT失败");
      });
  };

  // JWT提示信息
  const jwtHelpInfo =
    "JWT（JSON Web Token）结构说明：\n\n" +
    "1. 头部(Header)：包含token类型和算法\n" +
    "2. 载荷(Payload)：包含声明信息\n" +
    "3. 签名(Signature)：验证发送者身份和消息完整性\n\n" +
    "JWT格式：xxxxx.yyyyy.zzzzz（点号分隔的三部分）";

  const headerHelpInfo =
    "头部(Header)字段说明：\n\n" +
    "alg：签名算法（如HS256, RS256等）\n" +
    "typ：令牌类型，通常为JWT\n" +
    "kid：密钥ID（可选）\n" +
    "jku：密钥集URL（可选）\n" +
    "x5u：X.509证书URL（可选）";

  const payloadHelpInfo =
    "载荷(Payload)常用字段：\n\n" +
    "iss：签发者\n" +
    "sub：主题/用户ID\n" +
    "aud：接收方\n" +
    "exp：过期时间（UNIX时间戳）\n" +
    "nbf：生效时间（Not Before）\n" +
    "iat：签发时间（Issued At）\n" +
    "jti：JWT唯一标识符";

  const copySection = (value: string) => {
    void writeClipboardText(value)
      .then(() => toast.success("已复制到剪贴板"))
      .catch(() => toast.error("复制失败"));
  };
  const help = (label: string, content: string) => (
    <Tooltip content={content} className="max-w-xs whitespace-pre-line">
      <Button isIconOnly size="sm" variant="ghost" aria-label={label}>
        <CircleHelp />
      </Button>
    </Tooltip>
  );

  return (
    <ToolboxPageTemplate
      toolIcon="solar:document-lock-linear"
      toolName="JWT 解析与验证"
      description="左侧查看令牌与载荷，右侧检查头部和签名。"
      actions={
        <>
          <Button
            color="primary"
            size="sm"
            isDisabled={isProcessing || !jwtToken}
            onPress={parseJwt}
          >
            {isProcessing ? <Spinner size="sm" /> : <KeyRound />}解码 JWT
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={isProcessing}
            onPress={generateSampleJwt}
          >
            载入示例
          </Button>
          <Button
            variant="ghost"
            size="sm"
            isDisabled={isProcessing}
            onPress={handleReset}
          >
            <RotateCcw />
            重置内容
          </Button>
        </>
      }
      statusIndicator="解析成功不代表签名有效"
    >
      <div className="tool-jwt-layout">
        <div className="tool-jwt-main">
          <ToolPanel
            title="JWT 令牌"
            actions={
              <>
                {help("JWT 帮助", jwtHelpInfo)}
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="复制 JWT"
                  isDisabled={!jwtToken}
                  onPress={copyJwt}
                >
                  <Copy />
                </Button>
              </>
            }
          >
            <MonacoEditor
              ref={jwtEditorRef}
              language="plaintext"
              tabKey="jwt"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={jwtToken}
              onUpdateValue={(value) => {
                setJwtToken(value || "");
                setIsTokenValid(null);
                setValidationMessage("");
              }}
            />
          </ToolPanel>
          <ToolPanel
            title="Payload · 载荷"
            actions={
              <>
                {help("Payload 帮助", payloadHelpInfo)}
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="复制 Payload"
                  onPress={() => copySection(payloadJson || encodePayloadJson)}
                >
                  <Copy />
                </Button>
              </>
            }
          >
            <MonacoEditor
              ref={payloadEditorRef}
              language="json"
              tabKey="payload"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={payloadJson || encodePayloadJson}
              onUpdateValue={(value) => {
                setPayloadJson(value || "");
                setEncodePayloadJson(value || "");
              }}
            />
          </ToolPanel>
        </div>
        <aside className="tool-jwt-inspector" aria-label="JWT 检查器">
          <ToolPanel
            title="Header · 头部"
            className="tool-jwt-header"
            actions={
              <>
                {help("Header 帮助", headerHelpInfo)}
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="复制 Header"
                  onPress={() => copySection(headerJson || encodeHeaderJson)}
                >
                  <Copy />
                </Button>
              </>
            }
          >
            <MonacoEditor
              ref={headerEditorRef}
              language="json"
              tabKey="header"
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              value={headerJson || encodeHeaderJson}
              onUpdateValue={(value) => {
                setHeaderJson(value || "");
                setEncodeHeaderJson(value || "");
              }}
            />
          </ToolPanel>
          <ToolPanel title="签名检查与生成" className="tool-jwt-signature">
            <div className="tool-jwt-fields">
              <div
                role="status"
                aria-live="polite"
                className={`rounded-md border px-3 py-2 text-xs whitespace-pre-line break-words ${isTokenValid === true ? "border-success/30 bg-success/5 text-success" : isTokenValid === false ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}
              >
                {validationMessage || "尚未验证签名"}
              </div>
              <Select
                aria-label="签名算法"
                label="生成算法"
                selectedKeys={[selectedAlgorithm]}
                size="sm"
                onChange={(event) => {
                  setSelectedAlgorithm(event.target.value);
                  try {
                    const header = parseJson(headerJson || encodeHeaderJson);
                    header.alg = event.target.value;
                    const value = stringifyJson(header, 2);
                    setEncodeHeaderJson(value);
                    setHeaderJson(value);
                    headerEditorRef.current?.updateValue(value);
                  } catch {
                    toast.warning("头部 JSON 无效，请修正后再生成");
                  }
                }}
              >
                {[
                  "HS256",
                  "HS384",
                  "HS512",
                  "RS256",
                  "RS384",
                  "RS512",
                  "ES256",
                  "ES384",
                  "ES512",
                  "PS256",
                  "PS384",
                  "PS512",
                ].map((algorithm) => (
                  <SelectItem key={algorithm}>{algorithm}</SelectItem>
                ))}
              </Select>
              <Input
                aria-label="密钥"
                label="密钥"
                placeholder="输入签名密钥或验证公钥"
                value={secret}
                onChange={(event) => {
                  setSecret(event.target.value);
                  setIsTokenValid(null);
                  setValidationMessage("");
                }}
              />
              <p className="text-xs text-muted-foreground">
                验证使用令牌中的算法。非对称算法生成需要私钥，验证需要公钥。
              </p>
              <Button
                color="primary"
                size="sm"
                isDisabled={isProcessing || !secret || !jwtToken}
                onPress={verifyJwt}
              >
                <ShieldCheck />
                验证签名
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={isProcessing || !secret}
                onPress={encodeJwtToken}
              >
                生成 JWT
              </Button>
            </div>
          </ToolPanel>
        </aside>
      </div>
    </ToolboxPageTemplate>
  );
}
