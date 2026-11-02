import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

import 'app.dart';
import 'bootstrap/bootstrap_runner.dart';
import 'bootstrap/sdkwork_tls_trust.dart';
import 'bootstrap_gate.dart';

Future<void> main() async {
  // The HTTPS trust layer must be installed before any HTTP client is
  // created, so it runs ahead of binding initialization and services.
  SdkworkTlsTrust.installForApp();

  WidgetsFlutterBinding.ensureInitialized();
  await configureDefaultBirdCoderSessionStorage();
  runApp(
    BootstrapGate(
      bootstrap: bootstrapShellRuntime,
      builder: (bootstrapState) => BirdcoderApp(bootstrapState: bootstrapState),
    ),
  );
}
