import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sdkwork_birdcoder_flutter_mobile/shell/app_shell.dart';

void main() {
  testWidgets('tab navigation keeps the app shell mounted', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AppShell(
          child: const Text('chat page'),
          routePageBuilder: (path) => Text('page:$path'),
        ),
      ),
    );

    expect(find.text('chat page'), findsOneWidget);
    expect(find.byType(BottomNavigationBar), findsOneWidget);

    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();

    expect(find.text('page:/settings'), findsOneWidget);
    expect(find.byType(AppBar), findsOneWidget);
    expect(find.byType(BottomNavigationBar), findsOneWidget);

    await tester.tap(find.text('Chat'));
    await tester.pumpAndSettle();
    expect(find.text('chat page'), findsOneWidget);
    expect(find.byType(BottomNavigationBar), findsOneWidget);
  });
}
