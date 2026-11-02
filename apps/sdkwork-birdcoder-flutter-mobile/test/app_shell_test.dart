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

    final bar =
        tester.widget<BottomNavigationBar>(find.byType(BottomNavigationBar));
    expect(bar.items, hasLength(2));
    expect((bar.items[0].icon as Icon).icon, Icons.chat_bubble_outline);
    expect((bar.items[0].activeIcon as Icon).icon, Icons.chat_bubble);
    expect((bar.items[1].icon as Icon).icon, Icons.settings_outlined);
    expect((bar.items[1].activeIcon as Icon).icon, Icons.settings);

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
