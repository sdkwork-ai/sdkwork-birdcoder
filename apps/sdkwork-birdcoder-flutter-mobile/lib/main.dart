import 'package:flutter/material.dart';
import 'package:sdkwork_birdcoder_flutter_mobile_host/sdkwork_birdcoder_flutter_mobile_host.dart';

import 'bootstrap/bootstrap_runner.dart';
import 'bootstrap_gate.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDefaultBirdCoderSessionStorage();
  runApp(
    BootstrapGate(
      bootstrap: bootstrapShellRuntime,
      builder: (bootstrapState) => BirdcoderApp(bootstrapState: bootstrapState),
    ),
  );
}
