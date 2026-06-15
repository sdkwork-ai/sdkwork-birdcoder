import 'package:flutter/material.dart';

class AppProvider extends InheritedWidget {
  final String apiBaseUrl;

  const AppProvider({
    super.key,
    required this.apiBaseUrl,
    required super.child,
  });

  static AppProvider of(BuildContext context) {
    final provider = context.dependOnInheritedWidgetOfExactType<AppProvider>();
    assert(provider != null, 'No AppProvider found in context');
    return provider!;
  }

  @override
  bool updateShouldNotify(AppProvider oldWidget) {
    return apiBaseUrl != oldWidget.apiBaseUrl;
  }
}
