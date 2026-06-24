import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';

import '../pages/chat_page.dart';
import '../pages/settings_page.dart';

Widget buildBirdCoderRoutePage(String component) {
  switch (component) {
    case 'ChatPage':
      return const ChatPage();
    case 'SettingsPage':
      return const SettingsPage();
    default:
      return Scaffold(
        body: Center(
          child: Text('Unknown route component: $component'),
        ),
      );
  }
}

Widget buildBirdCoderRoutePageForPath(String path) {
  for (final route in createBirdCoderRouteCatalog()) {
    if (route.path == path) {
      return buildBirdCoderRoutePage(route.component);
    }
  }

  return Scaffold(
    body: Center(
      child: Text('Unknown route path: $path'),
    ),
  );
}
