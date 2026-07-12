import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show ThemeMode;
import 'package:shared_preferences/shared_preferences.dart';

/// Theme preference aligned with the mobile settings surface.
///
/// Exposed as a [ValueNotifier] so [MaterialApp] can rebuild with the
/// resolved [ThemeMode] whenever the user changes the dropdown in
/// `SettingsPage`. The preference is persisted through
/// [SharedPreferences] under the same key used by the settings page,
/// keeping a single source of truth for theme state across the app.
class ThemeController extends ValueNotifier<BirdCoderThemePreference> {
  ThemeController() : super(BirdCoderThemePreference.system);

  static const String _kPreferenceKey = 'theme';

  /// Load the persisted theme preference before the first frame so the
  /// initial [MaterialApp] build matches what the user last selected.
  Future<void> hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_kPreferenceKey);
      value = _decodeTheme(stored);
    } on Exception {
      // Keep system default when persistence is unavailable.
    }
  }

  /// Persist the new preference and notify listeners. The settings page
  /// calls this so the global [MaterialApp] rebuilds with the new
  /// [ThemeMode] immediately.
  Future<void> setPreference(BirdCoderThemePreference preference) async {
    value = preference;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kPreferenceKey, preference.name);
    } on Exception {
      // In-memory update still applies; persistence is best-effort.
    }
  }

  ThemeMode get themeMode => switch (value) {
        BirdCoderThemePreference.system => ThemeMode.system,
        BirdCoderThemePreference.light => ThemeMode.light,
        BirdCoderThemePreference.dark => ThemeMode.dark,
      };

  static BirdCoderThemePreference _decodeTheme(String? value) {
    switch (value) {
      case 'light':
        return BirdCoderThemePreference.light;
      case 'dark':
        return BirdCoderThemePreference.dark;
      case 'system':
      default:
        return BirdCoderThemePreference.system;
    }
  }
}

/// Theme preference enum shared between [ThemeController] and [SettingsPage].
///
/// Defined here so the controller does not depend on the settings page
/// widget tree; the settings page re-exports this enum for backward
/// compatibility with existing route registrations.
enum BirdCoderThemePreference { system, light, dark }
