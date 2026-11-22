import { t } from "@/i18n";
export const jsonPathSample = {
  users: [
    { id: 1, name: "张三", age: 25, department: "技术部", active: true },
    { id: 2, name: "李四", age: 30, department: "市场部", active: false },
    { id: 3, name: "王五", age: 28, department: "技术部", active: true },
    { id: 4, name: "赵六", age: 35, department: "人事部", active: true },
  ],
  metadata: { total: 4, "last updated": "2026-10-09" },
};

export const jsonPathExamples = [
  {
    get title() {
      return t("提取姓名");
    },
    path: "$.users[*].name",
    get description() {
      return t("遍历数组，获取每位用户的姓名");
    },
    get category() {
      return t("基础");
    },
  },
  {
    get title() {
      return t("第一个用户");
    },
    path: "$.users[0]",
    get description() {
      return t("数组下标从 0 开始");
    },
    get category() {
      return t("基础");
    },
  },
  {
    get title() {
      return t("条件筛选");
    },
    path: "$.users[?(@.age >= 28)]",
    get description() {
      return t("筛选年龄大于等于 28 的用户");
    },
    get category() {
      return t("筛选");
    },
  },
  {
    get title() {
      return t("组合条件");
    },
    path: "$.users[?(@.active == true && @.age < 30)].name",
    get description() {
      return t("获取活跃且小于 30 岁的用户姓名");
    },
    get category() {
      return t("筛选");
    },
  },
  {
    get title() {
      return t("数组切片");
    },
    path: "$.users[0:2]",
    get description() {
      return t("获取前两位用户，不含结束下标");
    },
    get category() {
      return t("基础");
    },
  },
  {
    get title() {
      return t("递归查找");
    },
    path: "$..name",
    get description() {
      return t("查找任意层级的 name 字段");
    },
    get category() {
      return t("进阶");
    },
  },
  {
    get title() {
      return t("中文字段值");
    },
    path: "$.users[?(@.department == '技术部')].name",
    get description() {
      return t("提取技术部用户的姓名");
    },
    get category() {
      return t("筛选");
    },
  },
  {
    get title() {
      return t("特殊字段名");
    },
    path: "$.metadata['last updated']",
    get description() {
      return t("包含空格或点号的键使用方括号");
    },
    get category() {
      return t("进阶");
    },
  },
] as const;
