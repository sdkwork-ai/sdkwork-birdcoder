import { defineLocaleModule } from '../resource.ts';

export default defineLocaleModule('terminal', {
  "terminal": {
    "closeTab": "关闭标签页",
    "closeOtherTabs": "关闭其他标签页",
    "closeTabsToRight": "关闭右侧标签页",
    "duplicateTab": "复制标签页",
    "splitTerminal": "拆分终端",
    "addTab": "新建标签页",
    "maximumSplitPanes": "最多支持 2 个拆分窗格",
    "terminalSplit": "终端已拆分",
    "otherTabsClosed": "其他标签页已关闭",
    "tabsToRightClosed": "右侧标签页已关闭",
    "openedNewTab": "已打开新的 {{title}} 标签页",
    "tabClosed": "标签页已关闭",
    "openSpecificProfile": "使用特定配置文件打开新标签页",
    "splitTerminalNotSupported": "此环境不支持拆分终端",
    "settings": "设置",
    "executing": "正在执行: {{command}}...",
    "error": "错误: {{error}}",
    "commandNotFound": "{{command}}: 找不到命令"
  }
});
