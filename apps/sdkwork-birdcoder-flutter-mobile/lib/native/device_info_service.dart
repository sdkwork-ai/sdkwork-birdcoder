import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'native_service_error.dart';

/// Result of a device info request.
class DeviceInfoResult {
  const DeviceInfoResult({required this.platform, required this.data});

  /// Operating system name (e.g. `android`, `ios`, `web`).
  final String platform;

  /// Raw device metadata reported by the platform plugin.
  final Map<String, dynamic> data;
}

/// Service contract for reading device hardware and OS metadata.
///
/// Wraps the `device_info_plus` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for availability errors.
abstract class DeviceInfoService {
  static DeviceInfoService? _instance;

  /// Returns the shared [DeviceInfoService] singleton.
  factory DeviceInfoService() => _instance ??= DeviceInfoServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(DeviceInfoService service) => _instance = service;

  /// Whether device metadata can be read on this device.
  Future<bool> isAvailable();

  /// Returns platform-specific device metadata as a normalized map.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.unavailable]
  /// when the platform channel cannot be reached, or [NativeServiceError.failed]
  /// on other errors.
  Future<DeviceInfoResult> getDeviceInfo();
}

class DeviceInfoServiceImpl implements DeviceInfoService {
  DeviceInfoServiceImpl();

  final _plugin = DeviceInfoPlugin();

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
  Future<DeviceInfoResult> getDeviceInfo() async => _resolve();

  Future<DeviceInfoResult> _resolve() async {
    try {
      if (kIsWeb) {
        final info = await _plugin.webBrowserInfo;
        return DeviceInfoResult(platform: 'web', data: info.data);
      }
      switch (defaultTargetPlatform) {
        case TargetPlatform.android:
          final info = await _plugin.androidInfo;
          return DeviceInfoResult(platform: 'android', data: info.data);
        case TargetPlatform.iOS:
          final info = await _plugin.iosInfo;
          return DeviceInfoResult(platform: 'ios', data: info.data);
        case TargetPlatform.macOS:
          final info = await _plugin.macOsInfo;
          return DeviceInfoResult(platform: 'macos', data: info.data);
        case TargetPlatform.windows:
          final info = await _plugin.windowsInfo;
          return DeviceInfoResult(platform: 'windows', data: info.data);
        case TargetPlatform.linux:
          final info = await _plugin.linuxInfo;
          return DeviceInfoResult(platform: 'linux', data: info.data);
        case TargetPlatform.fuchsia:
          throw const NativeServiceException(NativeServiceError.unsupported);
      }
    } on PlatformException catch (error) {
      throw NativeServiceException(
        NativeServiceError.unavailable,
        platformMessage: error.code,
      );
    } on MissingPluginException {
      throw const NativeServiceException(NativeServiceError.unavailable);
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }
}
