import 'package:flutter/material.dart';
import 'app.dart';
import 'bootstrap/environment.dart';
import 'bootstrap/runtime.dart';
import 'bootstrap/sdk_clients.dart';
import 'bootstrap/iam_runtime.dart';
import 'bootstrap/token_manager.dart';
import 'bootstrap/host_adapters.dart';
import 'bootstrap/routes.dart';

void main() {
  final environment = Environment.resolve();
  final runtime = AppRuntime.create();
  final sdkClients = SdkClients.create();
  final iamRuntime = IamRuntime.create();
  final tokenManager = TokenManager.create();
  final hostAdapters = HostAdapters.create();
  final routes = AppRoutes.create();

  debugPrint('[Flutter Bootstrap] env=${environment.mode}, routes=${routes.length}');

  runApp(const BirdcoderApp());
}
