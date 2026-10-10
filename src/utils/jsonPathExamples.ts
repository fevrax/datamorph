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
    title: "提取姓名",
    path: "$.users[*].name",
    description: "遍历数组，获取每位用户的姓名",
    category: "基础",
  },
  {
    title: "第一个用户",
    path: "$.users[0]",
    description: "数组下标从 0 开始",
    category: "基础",
  },
  {
    title: "条件筛选",
    path: "$.users[?(@.age >= 28)]",
    description: "筛选年龄大于等于 28 的用户",
    category: "筛选",
  },
  {
    title: "组合条件",
    path: "$.users[?(@.active == true && @.age < 30)].name",
    description: "获取活跃且小于 30 岁的用户姓名",
    category: "筛选",
  },
  {
    title: "数组切片",
    path: "$.users[0:2]",
    description: "获取前两位用户，不含结束下标",
    category: "基础",
  },
  {
    title: "递归查找",
    path: "$..name",
    description: "查找任意层级的 name 字段",
    category: "进阶",
  },
  {
    title: "中文字段值",
    path: "$.users[?(@.department == '技术部')].name",
    description: "提取技术部用户的姓名",
    category: "筛选",
  },
  {
    title: "特殊字段名",
    path: "$.metadata['last updated']",
    description: "包含空格或点号的键使用方括号",
    category: "进阶",
  },
] as const;
