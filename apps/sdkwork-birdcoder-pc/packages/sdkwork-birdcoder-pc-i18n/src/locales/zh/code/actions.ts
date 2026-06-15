import { defineLocaleModule } from '../../resource.ts';

export default defineLocaleModule('code/actions', {
  code: {
    noActiveDiff: '\u6ca1\u6709\u53ef\u663e\u793a\u7684\u5dee\u5f02',
    fileSaved: '\u6587\u4ef6\u5df2\u4fdd\u5b58',
    allFilesSaved: '\u5168\u90e8\u6587\u4ef6\u5df2\u4fdd\u5b58',
    startingApplication: '\u6b63\u5728\u542f\u52a8\u5e94\u7528...',
    revealedInExplorer: '\u5df2\u5728\u7cfb\u7edf\u8d44\u6e90\u7ba1\u7406\u5668\u4e2d\u663e\u793a\uff1a{{path}}',
    newSessionCreated: '\u65b0\u4f1a\u8bdd\u5df2\u521b\u5efa',
    failedToCreateSession: '\u521b\u5efa\u4f1a\u8bdd\u5931\u8d25',
    sessionDeleted: '\u4f1a\u8bdd\u5df2\u6210\u529f\u5220\u9664',
    projectDeleted: '\u9879\u76ee\u5df2\u6210\u529f\u5220\u9664',
    projectCreated: '\u9879\u76ee\u5df2\u6210\u529f\u521b\u5efa',
    failedToCreateProject: '\u521b\u5efa\u9879\u76ee\u5931\u8d25',
    openedFolder: '\u5df2\u6253\u5f00\u6587\u4ef6\u5939\uff1a{{name}}',
    failedToOpenFolder: '\u6253\u5f00\u6587\u4ef6\u5939\u5931\u8d25',
    messageDeleted: '\u6d88\u606f\u5df2\u6210\u529f\u5220\u9664',
    restoredFiles: '\u5df2\u5c06\u6587\u4ef6\u6062\u590d\u5230\u4e4b\u524d\u7684\u72b6\u6001',
    noResultsFound: '\u672a\u627e\u5230\u7ed3\u679c',
    runningConfiguration: '\u6b63\u5728\u8fd0\u884c\u914d\u7f6e...',
    runningDevTask: '\u6b63\u5728\u8fd0\u884c\u5f00\u53d1\u4efb\u52a1...',
    runningBuildTask: '\u6b63\u5728\u8fd0\u884c\u6784\u5efa\u4efb\u52a1...',
    runningTestTask: '\u6b63\u5728\u8fd0\u884c\u6d4b\u8bd5\u4efb\u52a1...',
    appliedChanges: '\u5df2\u5c06\u66f4\u6539\u5e94\u7528\u5230 {{path}}',
  },
});
