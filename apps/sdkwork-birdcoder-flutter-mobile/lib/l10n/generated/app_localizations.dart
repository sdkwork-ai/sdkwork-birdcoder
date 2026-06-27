import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('zh'),
    Locale('zh', 'TW')
  ];

  /// Application display name
  ///
  /// In en, this message translates to:
  /// **'BirdCoder'**
  String get app_title;

  /// Generic app loading message
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get app_loading;

  /// No description provided for @common_cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get common_cancel;

  /// No description provided for @common_confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get common_confirm;

  /// No description provided for @common_save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get common_save;

  /// No description provided for @common_delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get common_delete;

  /// No description provided for @common_loading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get common_loading;

  /// No description provided for @common_error.
  ///
  /// In en, this message translates to:
  /// **'An error occurred'**
  String get common_error;

  /// No description provided for @common_retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get common_retry;

  /// No description provided for @common_close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get common_close;

  /// No description provided for @common_back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get common_back;

  /// No description provided for @common_next.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get common_next;

  /// No description provided for @common_done.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get common_done;

  /// No description provided for @common_edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get common_edit;

  /// No description provided for @common_search.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get common_search;

  /// No description provided for @common_refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get common_refresh;

  /// No description provided for @common_yes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get common_yes;

  /// No description provided for @common_no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get common_no;

  /// No description provided for @chat_send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get chat_send;

  /// No description provided for @chat_input_placeholder.
  ///
  /// In en, this message translates to:
  /// **'Send a message...'**
  String get chat_input_placeholder;

  /// No description provided for @chat_empty.
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Start a conversation below.'**
  String get chat_empty;

  /// No description provided for @chat_loading_history.
  ///
  /// In en, this message translates to:
  /// **'Loading chat history...'**
  String get chat_loading_history;

  /// No description provided for @chat_message_user.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get chat_message_user;

  /// No description provided for @chat_message_assistant.
  ///
  /// In en, this message translates to:
  /// **'BirdCoder'**
  String get chat_message_assistant;

  /// No description provided for @chat_send_failed.
  ///
  /// In en, this message translates to:
  /// **'Failed to send message.'**
  String get chat_send_failed;

  /// No description provided for @chat_typing.
  ///
  /// In en, this message translates to:
  /// **'BirdCoder is typing...'**
  String get chat_typing;

  /// No description provided for @auth_login.
  ///
  /// In en, this message translates to:
  /// **'Log in'**
  String get auth_login;

  /// No description provided for @auth_logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get auth_logout;

  /// No description provided for @auth_signin.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get auth_signin;

  /// No description provided for @auth_signup.
  ///
  /// In en, this message translates to:
  /// **'Sign up'**
  String get auth_signup;

  /// No description provided for @auth_email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get auth_email;

  /// No description provided for @auth_password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get auth_password;

  /// No description provided for @auth_forgot_password.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get auth_forgot_password;

  /// No description provided for @auth_invalid_email.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email address.'**
  String get auth_invalid_email;

  /// No description provided for @auth_invalid_password.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters.'**
  String get auth_invalid_password;

  /// No description provided for @auth_login_failed.
  ///
  /// In en, this message translates to:
  /// **'Login failed. Please check your credentials.'**
  String get auth_login_failed;

  /// No description provided for @auth_register_success.
  ///
  /// In en, this message translates to:
  /// **'Registration successful. Please sign in.'**
  String get auth_register_success;

  /// No description provided for @settings_engine.
  ///
  /// In en, this message translates to:
  /// **'Engine'**
  String get settings_engine;

  /// No description provided for @settings_engine_description.
  ///
  /// In en, this message translates to:
  /// **'Select the rendering engine used to load the BirdCoder workspace.'**
  String get settings_engine_description;

  /// No description provided for @settings_engine_webview.
  ///
  /// In en, this message translates to:
  /// **'WebView'**
  String get settings_engine_webview;

  /// No description provided for @settings_engine_servo.
  ///
  /// In en, this message translates to:
  /// **'Servo'**
  String get settings_engine_servo;

  /// No description provided for @settings_engine_cef.
  ///
  /// In en, this message translates to:
  /// **'CEF'**
  String get settings_engine_cef;

  /// No description provided for @settings_theme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get settings_theme;

  /// No description provided for @settings_theme_description.
  ///
  /// In en, this message translates to:
  /// **'Choose how BirdCoder follows light, dark, or system appearance.'**
  String get settings_theme_description;

  /// No description provided for @settings_language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settings_language;

  /// No description provided for @settings_language_description.
  ///
  /// In en, this message translates to:
  /// **'Set the interface language for the mobile renderer.'**
  String get settings_language_description;

  /// No description provided for @settings_language_en.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get settings_language_en;

  /// No description provided for @settings_language_zh_hans.
  ///
  /// In en, this message translates to:
  /// **'Simplified Chinese'**
  String get settings_language_zh_hans;

  /// No description provided for @settings_language_zh_hant.
  ///
  /// In en, this message translates to:
  /// **'Traditional Chinese'**
  String get settings_language_zh_hant;

  /// No description provided for @settings_account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get settings_account;

  /// No description provided for @settings_account_description.
  ///
  /// In en, this message translates to:
  /// **'Session and local data management.'**
  String get settings_account_description;

  /// No description provided for @settings_logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get settings_logout;

  /// No description provided for @settings_clear_cache.
  ///
  /// In en, this message translates to:
  /// **'Clear cache'**
  String get settings_clear_cache;

  /// No description provided for @settings_cache_cleared.
  ///
  /// In en, this message translates to:
  /// **'Local cache cleared.'**
  String get settings_cache_cleared;

  /// No description provided for @settings_about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get settings_about;

  /// No description provided for @settings_about_description.
  ///
  /// In en, this message translates to:
  /// **'Privacy, support, and legal resources.'**
  String get settings_about_description;

  /// No description provided for @settings_official_website.
  ///
  /// In en, this message translates to:
  /// **'sdkwork.dev'**
  String get settings_official_website;

  /// No description provided for @settings_privacy_policy.
  ///
  /// In en, this message translates to:
  /// **'Privacy policy'**
  String get settings_privacy_policy;

  /// No description provided for @settings_terms_of_service.
  ///
  /// In en, this message translates to:
  /// **'Terms of service'**
  String get settings_terms_of_service;

  /// No description provided for @settings_support.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get settings_support;

  /// No description provided for @settings_dark_mode.
  ///
  /// In en, this message translates to:
  /// **'Dark mode'**
  String get settings_dark_mode;

  /// No description provided for @settings_light_mode.
  ///
  /// In en, this message translates to:
  /// **'Light mode'**
  String get settings_light_mode;

  /// No description provided for @settings_system_mode.
  ///
  /// In en, this message translates to:
  /// **'Follow system'**
  String get settings_system_mode;

  /// No description provided for @settings_version.
  ///
  /// In en, this message translates to:
  /// **'Version'**
  String get settings_version;

  /// No description provided for @native_error_unsupported.
  ///
  /// In en, this message translates to:
  /// **'This capability is not supported on this device.'**
  String get native_error_unsupported;

  /// No description provided for @native_error_permission_denied.
  ///
  /// In en, this message translates to:
  /// **'Permission was denied.'**
  String get native_error_permission_denied;

  /// No description provided for @native_error_unavailable.
  ///
  /// In en, this message translates to:
  /// **'The capability is unavailable right now.'**
  String get native_error_unavailable;

  /// No description provided for @native_error_cancelled.
  ///
  /// In en, this message translates to:
  /// **'The operation was cancelled.'**
  String get native_error_cancelled;

  /// No description provided for @native_error_invalid_state.
  ///
  /// In en, this message translates to:
  /// **'The operation could not complete in the current state.'**
  String get native_error_invalid_state;

  /// No description provided for @native_error_timeout.
  ///
  /// In en, this message translates to:
  /// **'The operation timed out.'**
  String get native_error_timeout;

  /// No description provided for @native_error_not_found.
  ///
  /// In en, this message translates to:
  /// **'The requested resource was not found.'**
  String get native_error_not_found;

  /// No description provided for @native_error_failed.
  ///
  /// In en, this message translates to:
  /// **'The operation failed.'**
  String get native_error_failed;

  /// No description provided for @nav_home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get nav_home;

  /// No description provided for @nav_chat.
  ///
  /// In en, this message translates to:
  /// **'Chat'**
  String get nav_chat;

  /// No description provided for @nav_settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get nav_settings;

  /// No description provided for @nav_profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get nav_profile;

  /// No description provided for @error_network.
  ///
  /// In en, this message translates to:
  /// **'Network error. Please check your connection.'**
  String get error_network;

  /// No description provided for @error_unknown.
  ///
  /// In en, this message translates to:
  /// **'An unknown error occurred.'**
  String get error_unknown;

  /// No description provided for @error_session_expired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please sign in again.'**
  String get error_session_expired;

  /// No description provided for @error_request_timeout.
  ///
  /// In en, this message translates to:
  /// **'The request timed out. Please try again.'**
  String get error_request_timeout;

  /// No description provided for @error_unauthorized.
  ///
  /// In en, this message translates to:
  /// **'You are not authorized to perform this action.'**
  String get error_unauthorized;

  /// No description provided for @error_server.
  ///
  /// In en, this message translates to:
  /// **'Server error. Please try again later.'**
  String get error_server;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+country codes are specified.
  switch (locale.languageCode) {
    case 'zh':
      {
        switch (locale.countryCode) {
          case 'TW':
            return AppLocalizationsZhTw();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
