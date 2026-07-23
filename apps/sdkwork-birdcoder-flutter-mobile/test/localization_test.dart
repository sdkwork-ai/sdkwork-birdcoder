import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

import 'package:sdkwork_birdcoder_flutter_mobile/app.dart';
import 'package:sdkwork_birdcoder_flutter_mobile/l10n/l10n.dart';

void main() {
  testWidgets('BirdcoderApp registers generated localization delegates', (
    tester,
  ) async {
    final tokenManager = BirdCoderTokenManager(
      sessionStorage: MemoryBirdCoderSessionStorage(),
    );
    final sdkClients = createBirdCoderFlutterSdkClients(
      apiBaseUrl: 'https://example.invalid',
      tokenManager: tokenManager,
    );
    final iamRuntime = createBirdCoderIamRuntime(sdkClients: sdkClients);
    addTearDown(iamRuntime.dispose);
    final bootstrapState = BirdCoderFlutterBootstrapState(
      environment: const BirdCoderFlutterEnvironment(
        mode: 'test',
        deploymentProfile: 'standalone',
        runtimeTarget: 'test-runner',
        configuredApiBaseUrl: 'https://example.invalid',
        isDevelopment: false,
        isProduction: false,
      ),
      apiBaseUrl: 'https://example.invalid',
      iamRuntime: iamRuntime,
      iamAuthService: BirdCoderIamAuthService(sdkClients: sdkClients),
      sdkClients: sdkClients,
      routes: createBirdCoderRouteCatalog(),
    );

    await tester.pumpWidget(BirdcoderApp(bootstrapState: bootstrapState));
    await tester.pump();

    final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(
      materialApp.localizationsDelegates,
      contains(AppLocalizations.delegate),
    );
    expect(materialApp.supportedLocales, AppL10n.supportedLocales);
  });

  testWidgets('generated app localization is available from the shared config',
      (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppL10n.localizationsDelegates,
        supportedLocales: AppL10n.supportedLocales,
        home: Builder(
          builder: (context) => Text(AppL10n.tr(context).agent_session_send),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Send'), findsOneWidget);
  });
}
