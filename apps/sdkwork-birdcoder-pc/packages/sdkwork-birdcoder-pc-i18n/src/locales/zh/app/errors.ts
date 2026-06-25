import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('app/errors', {
  "app": {
    "somethingWentWrong": "出错了",
    "unexpectedError": "应用程序中发生意外错误。请尝试刷新页面。",
    "unexpectedErrorReload": "发生意外错误。请重新加载应用程序。",
    "reloadApplication": "重新加载应用程序",
    "refresh": "刷新"
  }
});
