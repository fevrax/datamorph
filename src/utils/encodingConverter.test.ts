import {
  DEFAULT_ENCODING_OPTIONS,
  EncodingConversionError,
  convertEncoding,
  decodeToText,
  detectEncoding,
  encodeFromText,
  type EncodingOptions,
  type EncodingType,
} from "./encodingConverter";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

function assertThrows(action: () => void, message: string): void {
  let thrown = false;

  try {
    action();
  } catch (error) {
    thrown = error instanceof EncodingConversionError;
  }

  assert(thrown, message);
}

const sample = "你好，datamorph 😀\npath\\value\0";
const reversibleTypes: EncodingType[] = [
  "base64",
  "base64url",
  "url",
  "unicode",
  "hex",
  "binary",
];

for (const type of reversibleTypes) {
  const encoded = encodeFromText(sample, type);
  const decoded = decodeToText(encoded, type);

  assertEqual(decoded, sample, `${type} 应支持 UTF-8 往返转换`);
}

for (const source of reversibleTypes) {
  for (const target of reversibleTypes) {
    const sourceValue = encodeFromText(sample, source);
    const converted = convertEncoding(sourceValue, source, target);

    assertEqual(
      decodeToText(converted, target),
      sample,
      `${source} 到 ${target} 应保持原始文本`,
    );
  }
}

assertEqual(
  decodeToText("5L2g 5aW9", "base64"),
  "你好",
  "Base64 应忽略空白并补齐填充",
);
assertEqual(
  decodeToText("0xe4 0xbd 0xa0 0xe5 0xa5 0xbd", "hex"),
  "你好",
  "Hex 应接受分组和前缀",
);
assertEqual(
  decodeToText(
    "0b11100100 0b10111101 0b10100000 0b11100101 0b10100101 0b10111101",
    "binary",
  ),
  "你好",
  "Binary 应接受分组和前缀",
);
assertEqual(
  decodeToText("\\u4f60\\u597d \\u{1f600}", "unicode"),
  "你好 😀",
  "Unicode 应兼容固定长度和码点转义",
);

const formOptions: EncodingOptions = {
  ...DEFAULT_ENCODING_OPTIONS,
  urlMode: "form",
};

const base64UrlOptions: EncodingOptions = {
  ...DEFAULT_ENCODING_OPTIONS,
  base64Padding: false,
};

assertEqual(
  encodeFromText("你好", "base64url", base64UrlOptions),
  "5L2g5aW9",
  "Base64URL 应支持省略填充",
);

assertEqual(
  encodeFromText("a b&c", "url", formOptions),
  "a+b%26c",
  "表单 URL 模式应使用加号表示空格",
);
assertEqual(
  decodeToText("a+b%26c", "url", formOptions),
  "a b&c",
  "表单 URL 模式应正确解码加号",
);

const compactHexOptions: EncodingOptions = {
  ...DEFAULT_ENCODING_OPTIONS,
  hexUppercase: true,
  hexSeparator: "none",
  hexPrefix: true,
};

assertEqual(
  encodeFromText("Hi", "hex", compactHexOptions),
  "0x480x69",
  "Hex 输出选项应生效",
);

assertThrows(() => decodeToText("abc", "hex"), "奇数 Hex 必须报错");
assertThrows(() => decodeToText("0101", "binary"), "非完整字节必须报错");
assertThrows(() => decodeToText("%E4%ZZ", "url"), "无效 URL 必须报错");
assertThrows(() => decodeToText("/w==", "base64"), "无效 UTF-8 必须报错");
assertThrows(() => decodeToText("\\uD83D", "unicode"), "孤立代理项必须报错");

assertEqual(
  detectEncoding("\\u4f60\\u597d")?.type,
  "unicode",
  "应检测 Unicode 转义",
);
assertEqual(
  detectEncoding("%E4%BD%A0%E5%A5%BD")?.type,
  "url",
  "应检测 URL 编码",
);
assertEqual(detectEncoding("48 65 6c 6c 6f")?.type, "hex", "应检测分组 Hex");
assertEqual(
  detectEncoding("01001000 01101001")?.type,
  "binary",
  "应检测分组 Binary",
);
assertEqual(
  detectEncoding("5L2g5aW977yMSlNPTiBUb29scw==")?.type,
  "base64",
  "应检测高置信 Base64",
);
assertEqual(detectEncoding("hello"), null, "普通短文本不应误报");
assertEqual(detectEncoding("deadbeef"), null, "短 Hex 外观文本不应误报");
