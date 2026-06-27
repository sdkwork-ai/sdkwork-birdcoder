import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import 'native_service_error.dart';

/// Service contract for resolving platform file system directories.
///
/// Wraps the `path_provider` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for availability errors.
abstract class PathProviderService {
  static PathProviderService? _instance;

  /// Returns the shared [PathProviderService] singleton.
  factory PathProviderService() => _instance ??= PathProviderServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(PathProviderService service) => _instance = service;

  /// Whether directory paths can be resolved on this device.
  Future<bool> isAvailable();

  /// Returns the application's persistent documents directory path.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.unavailable]
  /// when the platform channel cannot be reached.
  Future<String> getApplicationDocumentsPath();

  /// Returns the application's transient cache directory path.
  Future<String> getTemporaryPath();

  /// Returns the application's support directory path.
  Future<String> getApplicationSupportPath();

  /// Returns the external storage directory path (Android only).
  Future<String?> getExternalStoragePath();
}

class PathProviderServiceImpl implements PathProviderService {
  PathProviderServiceImpl();

  @override
  Future<bool> isAvailable() async {
    try {
      await getTemporaryDirectory();
      return true;
    } on Exception {
      return false;
    }
  }

  @override
  Future<String> getApplicationDocumentsPath() => _resolve(
        getApplicationDocumentsDirectory,
      );

  @override
  Future<String> getTemporaryPath() => _resolve(getTemporaryDirectory);

  @override
  Future<String> getApplicationSupportPath() => _resolve(
        getApplicationSupportDirectory,
      );

  @override
  Future<String?> getExternalStoragePath() async {
    try {
      final directory = await getExternalStorageDirectory();
      return directory?.path;
    } on MissingPluginException {
      return null;
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.unavailable,
        platformMessage: error.toString(),
      );
    }
  }

  Future<String> _resolve(Future<Directory> Function() resolver) async {
    try {
      final directory = await resolver();
      return directory.path;
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
