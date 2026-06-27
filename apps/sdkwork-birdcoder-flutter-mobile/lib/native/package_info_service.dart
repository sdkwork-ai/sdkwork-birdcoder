import 'package:flutter/services.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'native_service_error.dart';

/// Application package metadata.
class PackageInfoResult {
  const PackageInfoResult({
    required this.appName,
    required this.packageName,
    required this.version,
    required this.buildNumber,
  });

  /// Display name of the application.
  final String appName;

  /// Bundle identifier (iOS) or application ID (Android).
  final String packageName;

  /// Semantic version string (e.g. `1.2.3`).
  final String version;

  /// Build number reported by the platform.
  final String buildNumber;
}

/// Service contract for reading application package metadata.
///
/// Wraps the `package_info_plus` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for availability errors.
abstract class PackageInfoService {
  static PackageInfoService? _instance;

  /// Returns the shared [PackageInfoService] singleton.
  factory PackageInfoService() => _instance ??= PackageInfoServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(PackageInfoService service) => _instance = service;

  /// Whether package metadata can be read on this device.
  Future<bool> isAvailable();

  /// Returns the application's package metadata.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.unavailable]
  /// when the platform channel cannot be reached.
  Future<PackageInfoResult> getPackageInfo();
}

class PackageInfoServiceImpl implements PackageInfoService {
  PackageInfoServiceImpl();

  PackageInfo? _cached;

  @override
  Future<bool> isAvailable() async {
    try {
      await _resolve();
      return true;
    } on Exception {
      return false;
    }
  }

  @override
  Future<PackageInfoResult> getPackageInfo() async {
    final info = await _resolve();
    return PackageInfoResult(
      appName: info.appName,
      packageName: info.packageName,
      version: info.version,
      buildNumber: info.buildNumber,
    );
  }

  Future<PackageInfo> _resolve() async {
    final cached = _cached;
    if (cached != null) {
      return cached;
    }
    try {
      final info = await PackageInfo.fromPlatform();
      _cached = info;
      return info;
    } on PlatformException catch (error) {
      throw NativeServiceException(
        NativeServiceError.unavailable,
        platformMessage: error.code,
      );
    } on MissingPluginException {
      throw const NativeServiceException(NativeServiceError.unavailable);
    }
  }
}
