import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/services.dart';

import 'native_service_error.dart';

/// Coarse-grained network connection type.
enum BirdCoderConnectivityType {
  none,
  wifi,
  cellular,
  ethernet,
  bluetooth,
  vpn,
  unknown,
}

/// Service contract for observing device network connectivity.
///
/// Wraps the `connectivity_plus` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for availability and failure.
abstract class ConnectivityService {
  static ConnectivityService? _instance;

  /// Returns the shared [ConnectivityService] singleton.
  factory ConnectivityService() => _instance ??= ConnectivityServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(ConnectivityService service) => _instance = service;

  /// Whether the connectivity API is reachable on this device.
  Future<bool> isAvailable();

  /// Returns the current network connection type.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.unavailable]
  /// when the platform channel cannot be reached.
  Future<BirdCoderConnectivityType> currentType();

  /// Emits the latest connection type whenever connectivity changes.
  ///
  /// Errors emitted by the platform are converted into [NativeServiceException]
  /// on the stream.
  Stream<BirdCoderConnectivityType> onChanged();
}

class ConnectivityServiceImpl implements ConnectivityService {
  ConnectivityServiceImpl();

  final _plugin = Connectivity();

  @override
  Future<bool> isAvailable() async {
    try {
      await _plugin.checkConnectivity();
      return true;
    } on Exception {
      return false;
    }
  }

  @override
  Future<BirdCoderConnectivityType> currentType() async {
    try {
      final results = await _plugin.checkConnectivity();
      return _mapConnectivityResults(results);
    } on PlatformException catch (error) {
      throw NativeServiceException(
        NativeServiceError.unavailable,
        platformMessage: error.code,
      );
    } on MissingPluginException {
      throw const NativeServiceException(NativeServiceError.unavailable);
    }
  }

  @override
  Stream<BirdCoderConnectivityType> onChanged() {
    return _plugin.onConnectivityChanged.asyncMap((results) {
      return _mapConnectivityResults(results);
    }).handleError((Object error) {
      if (error is PlatformException) {
        throw NativeServiceException(
          NativeServiceError.unavailable,
          platformMessage: error.code,
        );
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    });
  }

  BirdCoderConnectivityType _mapConnectivityResults(
      List<ConnectivityResult> results) {
    if (results.isEmpty) {
      return BirdCoderConnectivityType.none;
    }
    // Prefer the most informative active connection type in the list.
    if (results.contains(ConnectivityResult.wifi)) {
      return BirdCoderConnectivityType.wifi;
    }
    if (results.contains(ConnectivityResult.mobile)) {
      return BirdCoderConnectivityType.cellular;
    }
    if (results.contains(ConnectivityResult.ethernet)) {
      return BirdCoderConnectivityType.ethernet;
    }
    if (results.contains(ConnectivityResult.vpn)) {
      return BirdCoderConnectivityType.vpn;
    }
    if (results.contains(ConnectivityResult.bluetooth)) {
      return BirdCoderConnectivityType.bluetooth;
    }
    if (results.contains(ConnectivityResult.none)) {
      return BirdCoderConnectivityType.none;
    }
    return BirdCoderConnectivityType.unknown;
  }
}
