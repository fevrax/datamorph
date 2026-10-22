// src/stores/toolboxStore.ts
import { create } from "zustand";

export interface Tool {
  id: string;
  name: string;
  icon: string;
  description: string;
  path: string;
  category: string[];
}

interface ToolboxState {
  tools: Tool[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTools: () => Tool[];
}

const demoTools: Tool[] = [
  {
    id: "protoSort",
    name: "Protobuf 排序工具",
    icon: "mdi:sort-alphabetical-ascending",
    description: "为 Protobuf 字段重新编号，左右高亮展示排序前后的差异",
    path: "/toolbox/protoSort",
    category: ["数据处理", "Protobuf"],
  },
  {
    id: "jsonPath",
    name: "JSONPath 查询",
    icon: "mdi:filter",
    description:
      "使用 JSONPath 提取字段、筛选数组和递归查询，提供交互示例与语法指南",
    path: "/toolbox/jsonPath",
    category: ["数据处理", "查询"],
  },
  {
    id: "jsonAIRepair",
    name: "JSON AI 修复",
    icon: "fluent-emoji-flat:magic-wand",
    description: "AI 智能识别并修复JSON格式错误，让您的JSON数据恢复正常",
    path: "/toolbox/jsonAIRepair",
    category: ["AI", "数据处理"],
  },
  {
    id: "jsonTypeConverter",
    name: "对象类型转换器",
    icon: "fluent-color:code-block-24",
    description: "将JSON数据快速转换为TypeScript、GO、Java、Rust等对象",
    path: "/toolbox/jsonTypeConverter",
    category: ["AI", "数据处理", "代码生成"],
  },
  {
    id: "dataFormatConverter",
    name: "数据格式转换",
    icon: "token-branded:swap",
    description: "支持JSON5、YAML、XML、TOML等格式互相转换，支持AI转换",
    path: "/toolbox/dataFormatConverter",
    category: ["数据处理", "AI"],
  },
  {
    id: "jwtParse",
    name: "JWT解析与验证",
    icon: "icon-park-outline:key",
    description: "解析、验证JWT令牌，查看Header和Payload信息，支持签名验证",
    path: "/toolbox/jwtParse",
    category: ["安全工具", "数据处理"],
  },
  {
    id: "jsonKeyNaming",
    name: "JSON 字段命名转换",
    icon: "solar:text-selection-bold",
    description:
      "JSON字段命名风格转换，支持小驼峰、大驼峰、下划线、短横线和常量命名互转",
    path: "/toolbox/jsonKeyNaming",
    category: ["数据处理"],
  },
  {
    id: "encodingConverter",
    name: "编码转换",
    icon: "solar:code-square-bold",
    description: "实时转换 Base64、Base64URL、URL、Unicode、Hex 和 Binary 编码",
    path: "/toolbox/encodingConverter",
    category: ["编码转换", "数据处理"],
  },
];

export const useToolboxStore = create<ToolboxState>((set, get) => ({
  tools: demoTools,
  searchQuery: "",
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  filteredTools: () => {
    const { tools, searchQuery } = get();

    if (!searchQuery.trim()) return tools;

    const query = searchQuery.toLowerCase();

    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        (tool.category &&
          tool.category.some((cat) => cat.toLowerCase().includes(query))),
    );
  },
}));
