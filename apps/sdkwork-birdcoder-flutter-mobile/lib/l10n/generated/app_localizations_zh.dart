// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get app_title => 'BirdCoder';

  @override
  String get app_loading => '加载中...';

  @override
  String get common_cancel => '取消';

  @override
  String get common_confirm => '确认';

  @override
  String get common_save => '保存';

  @override
  String get common_delete => '删除';

  @override
  String get common_loading => '加载中...';

  @override
  String get common_error => '发生错误';

  @override
  String get common_retry => '重试';

  @override
  String get common_close => '关闭';

  @override
  String get common_back => '返回';

  @override
  String get common_next => '下一步';

  @override
  String get common_done => '完成';

  @override
  String get common_edit => '编辑';

  @override
  String get common_search => '搜索';

  @override
  String get common_refresh => '刷新';

  @override
  String get common_yes => '是';

  @override
  String get common_no => '否';

  @override
  String get chat_send => '发送';

  @override
  String get chat_input_placeholder => '发送消息...';

  @override
  String get chat_empty => '暂无消息，请在下方开始对话。';

  @override
  String get chat_loading_history => '正在加载聊天记录...';

  @override
  String get chat_message_user => '你';

  @override
  String get chat_message_assistant => 'BirdCoder';

  @override
  String get chat_send_failed => '发送消息失败。';

  @override
  String get chat_typing => 'BirdCoder 正在输入...';

  @override
  String get auth_login => '登录';

  @override
  String get auth_logout => '退出登录';

  @override
  String get auth_signin => '登录';

  @override
  String get auth_signup => '注册';

  @override
  String get auth_email => '邮箱';

  @override
  String get auth_password => '密码';

  @override
  String get auth_forgot_password => '忘记密码？';

  @override
  String get auth_invalid_email => '请输入有效的邮箱地址。';

  @override
  String get auth_invalid_password => '密码至少需要 8 个字符。';

  @override
  String get auth_login_failed => '登录失败，请检查您的凭据。';

  @override
  String get auth_register_success => '注册成功，请登录。';

  @override
  String get settings_engine => '引擎';

  @override
  String get settings_engine_description => '选择用于加载 BirdCoder 工作区的渲染引擎。';

  @override
  String get settings_engine_webview => 'WebView';

  @override
  String get settings_engine_servo => 'Servo';

  @override
  String get settings_engine_cef => 'CEF';

  @override
  String get settings_theme => '主题';

  @override
  String get settings_theme_description => '选择 BirdCoder 如何跟随浅色、深色或系统外观。';

  @override
  String get settings_language => '语言';

  @override
  String get settings_language_description => '设置移动渲染器的界面语言。';

  @override
  String get settings_language_en => '英语';

  @override
  String get settings_language_zh_hans => '简体中文';

  @override
  String get settings_language_zh_hant => '繁体中文';

  @override
  String get settings_account => '账户';

  @override
  String get settings_account_description => '会话与本地数据管理。';

  @override
  String get settings_logout => '退出登录';

  @override
  String get settings_clear_cache => '清除缓存';

  @override
  String get settings_cache_cleared => '本地缓存已清除。';

  @override
  String get settings_about => '关于';

  @override
  String get settings_about_description => '隐私、支持与法律资源。';

  @override
  String get settings_official_website => 'sdkwork.dev';

  @override
  String get settings_privacy_policy => '隐私政策';

  @override
  String get settings_terms_of_service => '服务条款';

  @override
  String get settings_support => '支持';

  @override
  String get settings_dark_mode => '深色模式';

  @override
  String get settings_light_mode => '浅色模式';

  @override
  String get settings_system_mode => '跟随系统';

  @override
  String get settings_version => '版本';

  @override
  String get native_error_unsupported => '此设备不支持该功能。';

  @override
  String get native_error_permission_denied => '权限被拒绝。';

  @override
  String get native_error_unavailable => '该功能当前不可用。';

  @override
  String get native_error_cancelled => '操作已取消。';

  @override
  String get native_error_invalid_state => '当前状态下无法完成操作。';

  @override
  String get native_error_timeout => '操作超时。';

  @override
  String get native_error_not_found => '未找到请求的资源。';

  @override
  String get native_error_failed => '操作失败。';

  @override
  String get nav_home => '首页';

  @override
  String get nav_chat => '聊天';

  @override
  String get nav_settings => '设置';

  @override
  String get nav_profile => '我的';

  @override
  String get error_network => '网络错误，请检查您的连接。';

  @override
  String get error_unknown => '发生未知错误。';

  @override
  String get error_session_expired => '您的会话已过期，请重新登录。';

  @override
  String get error_request_timeout => '请求超时，请重试。';

  @override
  String get error_unauthorized => '您无权执行此操作。';

  @override
  String get error_server => '服务器错误，请稍后重试。';
}

/// The translations for Chinese, as used in Taiwan (`zh_TW`).
class AppLocalizationsZhTw extends AppLocalizationsZh {
  AppLocalizationsZhTw() : super('zh_TW');

  @override
  String get app_title => 'BirdCoder';

  @override
  String get app_loading => '載入中...';

  @override
  String get common_cancel => '取消';

  @override
  String get common_confirm => '確認';

  @override
  String get common_save => '儲存';

  @override
  String get common_delete => '刪除';

  @override
  String get common_loading => '載入中...';

  @override
  String get common_error => '發生錯誤';

  @override
  String get common_retry => '重試';

  @override
  String get common_close => '關閉';

  @override
  String get common_back => '返回';

  @override
  String get common_next => '下一步';

  @override
  String get common_done => '完成';

  @override
  String get common_edit => '編輯';

  @override
  String get common_search => '搜尋';

  @override
  String get common_refresh => '重新整理';

  @override
  String get common_yes => '是';

  @override
  String get common_no => '否';

  @override
  String get chat_send => '傳送';

  @override
  String get chat_input_placeholder => '傳送訊息...';

  @override
  String get chat_empty => '尚無訊息，請在下方開始對話。';

  @override
  String get chat_loading_history => '正在載入聊天紀錄...';

  @override
  String get chat_message_user => '你';

  @override
  String get chat_message_assistant => 'BirdCoder';

  @override
  String get chat_send_failed => '傳送訊息失敗。';

  @override
  String get chat_typing => 'BirdCoder 正在輸入...';

  @override
  String get auth_login => '登入';

  @override
  String get auth_logout => '登出';

  @override
  String get auth_signin => '登入';

  @override
  String get auth_signup => '註冊';

  @override
  String get auth_email => '電子郵件';

  @override
  String get auth_password => '密碼';

  @override
  String get auth_forgot_password => '忘記密碼？';

  @override
  String get auth_invalid_email => '請輸入有效的電子郵件地址。';

  @override
  String get auth_invalid_password => '密碼至少需要 8 個字元。';

  @override
  String get auth_login_failed => '登入失敗，請檢查您的憑證。';

  @override
  String get auth_register_success => '註冊成功，請登入。';

  @override
  String get settings_engine => '引擎';

  @override
  String get settings_engine_description => '選擇用於載入 BirdCoder 工作區的渲染引擎。';

  @override
  String get settings_engine_webview => 'WebView';

  @override
  String get settings_engine_servo => 'Servo';

  @override
  String get settings_engine_cef => 'CEF';

  @override
  String get settings_theme => '主題';

  @override
  String get settings_theme_description => '選擇 BirdCoder 如何跟隨淺色、深色或系統外觀。';

  @override
  String get settings_language => '語言';

  @override
  String get settings_language_description => '設定行動渲染器的介面語言。';

  @override
  String get settings_language_en => '英語';

  @override
  String get settings_language_zh_hans => '簡體中文';

  @override
  String get settings_language_zh_hant => '繁體中文';

  @override
  String get settings_account => '帳戶';

  @override
  String get settings_account_description => '工作階段與本機資料管理。';

  @override
  String get settings_logout => '登出';

  @override
  String get settings_clear_cache => '清除快取';

  @override
  String get settings_cache_cleared => '本機快取已清除。';

  @override
  String get settings_about => '關於';

  @override
  String get settings_about_description => '隱私、支援與法律資源。';

  @override
  String get settings_official_website => 'sdkwork.dev';

  @override
  String get settings_privacy_policy => '隱私權政策';

  @override
  String get settings_terms_of_service => '服務條款';

  @override
  String get settings_support => '支援';

  @override
  String get settings_dark_mode => '深色模式';

  @override
  String get settings_light_mode => '淺色模式';

  @override
  String get settings_system_mode => '跟隨系統';

  @override
  String get settings_version => '版本';

  @override
  String get native_error_unsupported => '此裝置不支援該功能。';

  @override
  String get native_error_permission_denied => '權限被拒絕。';

  @override
  String get native_error_unavailable => '該功能目前無法使用。';

  @override
  String get native_error_cancelled => '操作已取消。';

  @override
  String get native_error_invalid_state => '目前狀態下無法完成操作。';

  @override
  String get native_error_timeout => '操作逾時。';

  @override
  String get native_error_not_found => '找不到要求的資源。';

  @override
  String get native_error_failed => '操作失敗。';

  @override
  String get nav_home => '首頁';

  @override
  String get nav_chat => '聊天';

  @override
  String get nav_settings => '設定';

  @override
  String get nav_profile => '我的';

  @override
  String get error_network => '網路錯誤，請檢查您的連線。';

  @override
  String get error_unknown => '發生未知錯誤。';

  @override
  String get error_session_expired => '您的工作階段已過期，請重新登入。';

  @override
  String get error_request_timeout => '請求逾時，請重試。';

  @override
  String get error_unauthorized => '您無權執行此操作。';

  @override
  String get error_server => '伺服器錯誤，請稍後重試。';
}
