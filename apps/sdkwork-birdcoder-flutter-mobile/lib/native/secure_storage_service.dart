import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'native_service_error.dart';

const _iosOptions = IOSOptions(
  accessibility: KeychainAccessibility.first_unlock_this_device,
);

const _androidOptions = AndroidOptions(
  encryptedSharedPreferences: true,
);

/// Service contract for encrypted key-value storage.
///
/// Wraps the `flutter_secure_storage` plugin behind a typed, testable
/// interface so feature widgets never import plugin classes directly.
/// Implementations expose stable [NativeServiceError] codes for platform and
/// failure errors. This service is independent from the host session storage
/// wiring; it offers a general-purpose secret vault for capabilities such as
/// OAuth tokens, feature flags, and user preferences that must not be stored
/// in plaintext.
abstract class SecureStorageService {
  static SecureStorageService? _instance;

  /// Returns the shared [SecureStorageService] singleton.
  factory SecureStorageService() => _instance ??= SecureStorageServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(SecureStorageService service) => _instance = service;

  /// Whether secure storage is reachable on this device.
  Future<bool> isAvailable();

  /// Reads the value stored at [key], or `null` when absent.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.failed] on
  /// platform errors.
  Future<String?> read(String key);

  /// Writes [value] to [key], replacing any prior value.
  Future<void> write(String key, String value);

  /// Deletes the value at [key], if present.
  Future<void> delete(String key);

  /// Whether a value is currently stored at [key].
  Future<bool> containsKey(String key);

  /// Returns all stored key/value pairs.
  Future<Map<String, String>> readAll();

  /// Removes every stored key/value pair.
  Future<void> deleteAll();
}

class SecureStorageServiceImpl implements SecureStorageService {
  SecureStorageServiceImpl();

  final _storage = const FlutterSecureStorage(
    aOptions: _androidOptions,
    iOptions: _iosOptions,
  );

  @override
  Future<bool> isAvailable() async {
    try {
      await _storage.read(key: '__availability_probe__');
      return true;
    } on Exception {
      return false;
    }
  }

  @override
  Future<String?> read(String key) => _guard(() => _storage.read(key: key));

  @override
  Future<void> write(String key, String value) =>
      _guard(() => _storage.write(key: key, value: value));

  @override
  Future<void> delete(String key) =>
      _guard(() => _storage.delete(key: key));

  @override
  Future<bool> containsKey(String key) =>
      _guard(() => _storage.containsKey(key: key));

  @override
  Future<Map<String, String>> readAll() => _guard(_storage.readAll);

  @override
  Future<void> deleteAll() => _guard(_storage.deleteAll);

  Future<T> _guard<T>(Future<T> Function() op) async {
    try {
      return await op();
    } on PlatformException catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
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
