import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/l10n.dart';
import '../providers/app_provider.dart';
import '../providers/theme_controller.dart';

/// Rendering engine preference surfaced in the mobile settings screen.
enum BirdCoderEnginePreference { webview, servo, cef }

/// Language preference aligned with the mobile i18n catalog.
enum BirdCoderLanguagePreference { en, zhHans, zhHant }

// `BirdCoderThemePreference` is re-exported from `theme_controller.dart`
// so that [ThemeController] remains the single source of truth for
// theme state across the app.

const String _kBirdCoderSettingsPrefsKey =
    'sdkwork.birdcoder.flutter.settings.v1';
const String _kBirdCoderSessionKey = 'sdkwork.birdcoder.appSession.v1';
const String _kBirdCoderStoragePrefix = 'sdkwork.birdcoder.';

const String _kOfficialWebsiteUrl =
    'https://sdkwork.com/apps/sdkwork-birdcoder';
const String _kPrivacyPolicyUrl = 'https://sdkwork.com/privacy';
const String _kTermsOfServiceUrl = 'https://sdkwork.com/terms';
const String _kSupportUrl = 'https://sdkwork.com/support';

/// Mobile settings surface wired through the canonical Flutter route catalog.
///
/// Preferences (rendering engine, theme, language) are persisted with
/// [SharedPreferences] and translated through [AppL10n]. The page also exposes
/// account actions (sign out, clear cache) and an about section linking to
/// official, privacy, terms, and support resources.
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  BirdCoderEnginePreference _engine = BirdCoderEnginePreference.webview;
  BirdCoderLanguagePreference _language = BirdCoderLanguagePreference.en;
  String _version = '0.1.0';
  bool _cacheCleared = false;
  bool _prefsLoaded = false;
  late ThemeController _themeController;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _themeController = AppProvider.of(context).themeController;
    if (!_prefsLoaded) {
      _loadPreferences();
      _loadPackageInfo();
    }
  }

  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        _engine = _decodeEngine(prefs.getString('engine')) ?? _engine;
        _language = _decodeLanguage(prefs.getString('language')) ?? _language;
        _prefsLoaded = true;
      });
      // Theme is hydrated by ThemeController at app start; keep it in sync
      // in case the controller has not finished hydrating yet.
      await _themeController.hydrate();
    } on Exception {
      // Preferences remain at defaults when persistence is unavailable.
      setState(() => _prefsLoaded = true);
    }
  }

  Future<void> _loadPackageInfo() async {
    try {
      final info = await PackageInfo.fromPlatform();
      setState(() => _version = info.version);
    } on Exception {
      // Fall back to the bundled constant version when package info is missing.
    }
  }

  Future<void> _persistPreference(String key, String value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          _kBirdCoderSettingsPrefsKey, DateTime.now().toIso8601String());
      await prefs.setString(key, value);
    } on Exception {
      // Preference stays in-memory when persistence fails.
    }
  }

  Future<void> _setEngine(BirdCoderEnginePreference engine) async {
    setState(() => _engine = engine);
    await _persistPreference('engine', engine.name);
  }

  Future<void> _setTheme(BirdCoderThemePreference theme) async {
    // Delegate to ThemeController so the global MaterialApp rebuilds with
    // the new ThemeMode immediately. The controller persists the value.
    await _themeController.setPreference(theme);
  }

  Future<void> _setLanguage(BirdCoderLanguagePreference language) async {
    setState(() => _language = language);
    await _persistPreference('language', language.name);
  }

  Future<void> _clearCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((key) =>
          key.startsWith(_kBirdCoderStoragePrefix) &&
          key != _kBirdCoderSessionKey);
      for (final key in keys) {
        await prefs.remove(key);
      }
    } on Exception {
      // Best-effort cache clearing; surface no error to the user.
    }
    setState(() {
      _engine = BirdCoderEnginePreference.webview;
      _language = BirdCoderLanguagePreference.en;
      _cacheCleared = true;
    });
    await _themeController.setPreference(BirdCoderThemePreference.system);
  }

  Future<void> _signOut() async {
    final provider = AppProvider.of(context);
    await provider.iamAuthService.signOut(iamRuntime: provider.iamRuntime);
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } on Exception {
      // Ignore launch failures silently on mobile; the link is informational.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppL10n.tr(context);
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(l10n.nav_settings, style: theme.textTheme.headlineSmall),
        const SizedBox(height: 16),
        _buildSection(
          context,
          title: l10n.settings_engine,
          description: l10n.settings_engine_description,
          child: _buildEngineDropdown(context),
        ),
        _buildSection(
          context,
          title: l10n.settings_theme,
          description: l10n.settings_theme_description,
          child: _buildThemeDropdown(context),
        ),
        _buildSection(
          context,
          title: l10n.settings_language,
          description: l10n.settings_language_description,
          child: _buildLanguageDropdown(context),
        ),
        _buildSection(
          context,
          title: l10n.settings_account,
          description: l10n.settings_account_description,
          child: _buildAccountActions(context),
        ),
        _buildSection(
          context,
          title: l10n.settings_about,
          description: l10n.settings_about_description,
          child: _buildAboutLinks(context),
        ),
        const SizedBox(height: 8),
        Text('Route: app.account.settings.index',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        Text('${l10n.settings_version}: $_version',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      ],
    );
  }

  Widget _buildSection(
    BuildContext context, {
    required String title,
    required String description,
    required Widget child,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.titleSmall),
              const SizedBox(height: 4),
              Text(description,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 12),
              child,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEngineDropdown(BuildContext context) {
    final l10n = AppL10n.tr(context);
    return _SettingsDropdown<BirdCoderEnginePreference>(
      value: _engine,
      items: const {
        BirdCoderEnginePreference.webview: null,
        BirdCoderEnginePreference.servo: null,
        BirdCoderEnginePreference.cef: null,
      },
      labelOf: (engine) => switch (engine) {
        BirdCoderEnginePreference.webview => l10n.settings_engine_webview,
        BirdCoderEnginePreference.servo => l10n.settings_engine_servo,
        BirdCoderEnginePreference.cef => l10n.settings_engine_cef,
      },
      onChanged: _prefsLoaded ? _setEngine : null,
    );
  }

  Widget _buildThemeDropdown(BuildContext context) {
    final l10n = AppL10n.tr(context);
    return ValueListenableBuilder<BirdCoderThemePreference>(
      valueListenable: _themeController,
      builder: (context, currentTheme, _) {
        return _SettingsDropdown<BirdCoderThemePreference>(
          value: currentTheme,
          items: const {
            BirdCoderThemePreference.system: null,
            BirdCoderThemePreference.light: null,
            BirdCoderThemePreference.dark: null,
          },
          labelOf: (theme) => switch (theme) {
            BirdCoderThemePreference.system => l10n.settings_system_mode,
            BirdCoderThemePreference.light => l10n.settings_light_mode,
            BirdCoderThemePreference.dark => l10n.settings_dark_mode,
          },
          onChanged: _prefsLoaded ? _setTheme : null,
        );
      },
    );
  }

  Widget _buildLanguageDropdown(BuildContext context) {
    final l10n = AppL10n.tr(context);
    return _SettingsDropdown<BirdCoderLanguagePreference>(
      value: _language,
      items: const {
        BirdCoderLanguagePreference.en: null,
        BirdCoderLanguagePreference.zhHans: null,
        BirdCoderLanguagePreference.zhHant: null,
      },
      labelOf: (language) => switch (language) {
        BirdCoderLanguagePreference.en => l10n.settings_language_en,
        BirdCoderLanguagePreference.zhHans => l10n.settings_language_zh_hans,
        BirdCoderLanguagePreference.zhHant => l10n.settings_language_zh_hant,
      },
      onChanged: _prefsLoaded ? _setLanguage : null,
    );
  }

  Widget _buildAccountActions(BuildContext context) {
    final l10n = AppL10n.tr(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.settings_logout),
          leading: const Icon(Icons.logout),
          onTap: _signOut,
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.settings_clear_cache),
          leading: const Icon(Icons.cleaning_services_outlined),
          onTap: _clearCache,
        ),
        if (_cacheCleared)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(l10n.settings_cache_cleared,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ),
      ],
    );
  }

  Widget _buildAboutLinks(BuildContext context) {
    final l10n = AppL10n.tr(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.settings_official_website),
          leading: const Icon(Icons.language),
          onTap: () => _openUrl(_kOfficialWebsiteUrl),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.settings_privacy_policy),
          leading: const Icon(Icons.privacy_tip_outlined),
          onTap: () => _openUrl(_kPrivacyPolicyUrl),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.settings_terms_of_service),
          leading: const Icon(Icons.description_outlined),
          onTap: () => _openUrl(_kTermsOfServiceUrl),
        ),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(l10n.settings_support),
          leading: const Icon(Icons.support_agent),
          onTap: () => _openUrl(_kSupportUrl),
        ),
      ],
    );
  }
}

class _SettingsDropdown<T extends Enum> extends StatelessWidget {
  const _SettingsDropdown({
    required this.value,
    required this.items,
    required this.labelOf,
    required this.onChanged,
  });

  final T value;
  final Map<T, dynamic> items;
  final String Function(T) labelOf;
  final Future<void> Function(T)? onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      decoration: const InputDecoration(border: OutlineInputBorder()),
      items: items.keys
          .map((entry) => DropdownMenuItem<T>(
                value: entry,
                child: Text(labelOf(entry)),
              ))
          .toList(),
      onChanged: onChanged == null
          ? null
          : (selected) {
              if (selected != null) {
                onChanged!(selected);
              }
            },
    );
  }
}

BirdCoderEnginePreference? _decodeEngine(String? value) {
  switch (value) {
    case 'webview':
      return BirdCoderEnginePreference.webview;
    case 'servo':
      return BirdCoderEnginePreference.servo;
    case 'cef':
      return BirdCoderEnginePreference.cef;
    default:
      return null;
  }
}

BirdCoderLanguagePreference? _decodeLanguage(String? value) {
  switch (value) {
    case 'en':
      return BirdCoderLanguagePreference.en;
    case 'zhHans':
      return BirdCoderLanguagePreference.zhHans;
    case 'zhHant':
      return BirdCoderLanguagePreference.zhHant;
    default:
      return null;
  }
}
