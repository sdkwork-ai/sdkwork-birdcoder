import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

import 'native_service_error.dart';

/// Service contract for biometric and device credential authentication.
///
/// Wraps the `local_auth` plugin behind a typed, testable interface so feature
/// widgets never import plugin classes directly. Implementations expose stable
/// [NativeServiceError] codes for availability, permission, and cancellation.
abstract class LocalAuthService {
  static LocalAuthService? _instance;

  /// Returns the shared [LocalAuthService] singleton.
  factory LocalAuthService() => _instance ??= LocalAuthServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(LocalAuthService service) => _instance = service;

  /// Whether the device exposes any enrolled biometric or credential method.
  Future<bool> isAvailable();

  /// Prompts the user for biometric or device credential authentication.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.unavailable]
  /// when no biometric is enrolled, [NativeServiceError.cancelled] when the
  /// user dismisses the prompt, [NativeServiceError.permissionDenied] when
  /// the app lacks permission, or [NativeServiceError.failed] on other errors.
  Future<bool> authenticate({required String reason});
}

class LocalAuthServiceImpl implements LocalAuthService {
  LocalAuthServiceImpl();

  final _auth = LocalAuthentication();

  @override
  Future<bool> isAvailable() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      return canCheck || isDeviceSupported;
    } on Exception {
      return false;
    }
  }

  @override
  Future<bool> authenticate({required String reason}) async {
    try {
      final didAuthenticate = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
        ),
      );
      return didAuthenticate;
    } on PlatformException catch (error) {
      final code = error.code.toLowerCase();
      if (code.contains('not_available') || code.contains('not_enrolled')) {
        throw NativeServiceException(
          NativeServiceError.unavailable,
          platformMessage: error.code,
        );
      }
      if (code.contains('cancel')) {
        throw const NativeServiceException(NativeServiceError.cancelled);
      }
      if (code.contains('permission') || code.contains('denied')) {
        throw NativeServiceException(
          NativeServiceError.permissionDenied,
          platformMessage: error.code,
        );
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    }
  }
}
