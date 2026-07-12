import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sdkwork_birdcoder_flutter_mobile/providers/theme_controller.dart';

void main() {
  test('theme preferences map to Material theme modes', () async {
    SharedPreferences.setMockInitialValues({});
    final controller = ThemeController();
    addTearDown(controller.dispose);

    expect(controller.themeMode, ThemeMode.system);

    await controller.setPreference(BirdCoderThemePreference.dark);
    expect(controller.themeMode, ThemeMode.dark);

    await controller.setPreference(BirdCoderThemePreference.light);
    expect(controller.themeMode, ThemeMode.light);
  });
}
