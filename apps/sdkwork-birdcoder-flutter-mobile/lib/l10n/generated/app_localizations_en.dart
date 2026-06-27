// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get app_title => 'BirdCoder';

  @override
  String get app_loading => 'Loading...';

  @override
  String get common_cancel => 'Cancel';

  @override
  String get common_confirm => 'Confirm';

  @override
  String get common_save => 'Save';

  @override
  String get common_delete => 'Delete';

  @override
  String get common_loading => 'Loading...';

  @override
  String get common_error => 'An error occurred';

  @override
  String get common_retry => 'Retry';

  @override
  String get common_close => 'Close';

  @override
  String get common_back => 'Back';

  @override
  String get common_next => 'Next';

  @override
  String get common_done => 'Done';

  @override
  String get common_edit => 'Edit';

  @override
  String get common_search => 'Search';

  @override
  String get common_refresh => 'Refresh';

  @override
  String get common_yes => 'Yes';

  @override
  String get common_no => 'No';

  @override
  String get chat_send => 'Send';

  @override
  String get chat_input_placeholder => 'Send a message...';

  @override
  String get chat_empty => 'No messages yet. Start a conversation below.';

  @override
  String get chat_loading_history => 'Loading chat history...';

  @override
  String get chat_message_user => 'You';

  @override
  String get chat_message_assistant => 'BirdCoder';

  @override
  String get chat_send_failed => 'Failed to send message.';

  @override
  String get chat_typing => 'BirdCoder is typing...';

  @override
  String get auth_login => 'Log in';

  @override
  String get auth_logout => 'Log out';

  @override
  String get auth_signin => 'Sign in';

  @override
  String get auth_signup => 'Sign up';

  @override
  String get auth_email => 'Email';

  @override
  String get auth_password => 'Password';

  @override
  String get auth_forgot_password => 'Forgot password?';

  @override
  String get auth_invalid_email => 'Please enter a valid email address.';

  @override
  String get auth_invalid_password => 'Password must be at least 8 characters.';

  @override
  String get auth_login_failed =>
      'Login failed. Please check your credentials.';

  @override
  String get auth_register_success =>
      'Registration successful. Please sign in.';

  @override
  String get settings_engine => 'Engine';

  @override
  String get settings_engine_description =>
      'Select the rendering engine used to load the BirdCoder workspace.';

  @override
  String get settings_engine_webview => 'WebView';

  @override
  String get settings_engine_servo => 'Servo';

  @override
  String get settings_engine_cef => 'CEF';

  @override
  String get settings_theme => 'Theme';

  @override
  String get settings_theme_description =>
      'Choose how BirdCoder follows light, dark, or system appearance.';

  @override
  String get settings_language => 'Language';

  @override
  String get settings_language_description =>
      'Set the interface language for the mobile renderer.';

  @override
  String get settings_language_en => 'English';

  @override
  String get settings_language_zh_hans => 'Simplified Chinese';

  @override
  String get settings_language_zh_hant => 'Traditional Chinese';

  @override
  String get settings_account => 'Account';

  @override
  String get settings_account_description =>
      'Session and local data management.';

  @override
  String get settings_logout => 'Log out';

  @override
  String get settings_clear_cache => 'Clear cache';

  @override
  String get settings_cache_cleared => 'Local cache cleared.';

  @override
  String get settings_about => 'About';

  @override
  String get settings_about_description =>
      'Privacy, support, and legal resources.';

  @override
  String get settings_official_website => 'sdkwork.dev';

  @override
  String get settings_privacy_policy => 'Privacy policy';

  @override
  String get settings_terms_of_service => 'Terms of service';

  @override
  String get settings_support => 'Support';

  @override
  String get settings_dark_mode => 'Dark mode';

  @override
  String get settings_light_mode => 'Light mode';

  @override
  String get settings_system_mode => 'Follow system';

  @override
  String get settings_version => 'Version';

  @override
  String get native_error_unsupported =>
      'This capability is not supported on this device.';

  @override
  String get native_error_permission_denied => 'Permission was denied.';

  @override
  String get native_error_unavailable =>
      'The capability is unavailable right now.';

  @override
  String get native_error_cancelled => 'The operation was cancelled.';

  @override
  String get native_error_invalid_state =>
      'The operation could not complete in the current state.';

  @override
  String get native_error_timeout => 'The operation timed out.';

  @override
  String get native_error_not_found => 'The requested resource was not found.';

  @override
  String get native_error_failed => 'The operation failed.';

  @override
  String get nav_home => 'Home';

  @override
  String get nav_chat => 'Chat';

  @override
  String get nav_settings => 'Settings';

  @override
  String get nav_profile => 'Profile';

  @override
  String get error_network => 'Network error. Please check your connection.';

  @override
  String get error_unknown => 'An unknown error occurred.';

  @override
  String get error_session_expired =>
      'Your session has expired. Please sign in again.';

  @override
  String get error_request_timeout =>
      'The request timed out. Please try again.';

  @override
  String get error_unauthorized =>
      'You are not authorized to perform this action.';

  @override
  String get error_server => 'Server error. Please try again later.';
}
