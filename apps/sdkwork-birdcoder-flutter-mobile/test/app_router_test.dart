import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sdkwork_birdcoder_flutter_mobile/auth_gate.dart';
import 'package:sdkwork_birdcoder_flutter_mobile/routes/app_router.dart';
import 'package:sdkwork_birdcoder_flutter_mobile/shell/app_shell.dart';

void main() {
  testWidgets('business named routes are wrapped by AuthGate', (tester) async {
    BuildContext? context;
    await tester.pumpWidget(
      Builder(
        builder: (builderContext) {
          context = builderContext;
          return const SizedBox();
        },
      ),
    );

    final route = AppRouter.generateRoute(
      const RouteSettings(name: '/settings'),
    );
    final pageRoute = route as MaterialPageRoute<dynamic>;
    final page = pageRoute.builder(context!);

    expect(page, isA<AuthGate>());
    expect((page as AuthGate).child, isA<AppShell>());
  });
}
