import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

import 'native_service_error.dart';

/// BirdCoder permission groups decoupled from the plugin's [Permission] enum.
///
/// Keep this list focused on the capabilities BirdCoder actually requests so
/// the mapping stays small and auditable.
enum BirdCoderPermission {
  camera,
  photos,
  storage,
  location,
  microphone,
  notification,
}

/// BirdCoder permission status decoupled from the plugin enum.
enum BirdCoderPermissionStatus {
  denied,
  granted,
  restricted,
  limited,
  permanentlyDenied,
}

/// Service contract for checking and requesting runtime permissions.
///
/// Wraps the `permission_handler` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for availability and failure.
abstract class PermissionService {
  static PermissionService? _instance;

  /// Returns the shared [PermissionService] singleton.
  factory PermissionService() => _instance ??= PermissionServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(PermissionService service) => _instance = service;

  /// Whether the permission API is available on this device.
  Future<bool> isAvailable();

  /// Returns the current status of [permission] without prompting the user.
  Future<BirdCoderPermissionStatus> checkPermission(
      BirdCoderPermission permission);

  /// Prompts the user to grant [permission] and returns the resulting status.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.failed] when the
  /// platform rejects the request, or [NativeServiceError.unavailable] when
  /// the permission is unsupported on the current platform.
  Future<BirdCoderPermissionStatus> requestPermission(
      BirdCoderPermission permission);
}

class PermissionServiceImpl implements PermissionService {
  PermissionServiceImpl();

  @override
  Future<bool> isAvailable() => Future.value(true);

  @override
  Future<BirdCoderPermissionStatus> checkPermission(
      BirdCoderPermission permission) async {
    final pluginPermission = _mapPermission(permission);
    try {
      final status = await pluginPermission.status;
      return _mapStatus(status);
    } on PlatformException catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    } on MissingPluginException {
      throw const NativeServiceException(NativeServiceError.unavailable);
    }
  }

  @override
  Future<BirdCoderPermissionStatus> requestPermission(
      BirdCoderPermission permission) async {
    final pluginPermission = _mapPermission(permission);
    try {
      final status = await pluginPermission.request();
      return _mapStatus(status);
    } on PlatformException catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    } on MissingPluginException {
      throw const NativeServiceException(NativeServiceError.unavailable);
    }
  }

  Permission _mapPermission(BirdCoderPermission permission) {
    switch (permission) {
      case BirdCoderPermission.camera:
        return Permission.camera;
      case BirdCoderPermission.photos:
        return Permission.photos;
      case BirdCoderPermission.storage:
        return Permission.storage;
      case BirdCoderPermission.location:
        return Permission.location;
      case BirdCoderPermission.microphone:
        return Permission.microphone;
      case BirdCoderPermission.notification:
        return Permission.notification;
    }
  }

  BirdCoderPermissionStatus _mapStatus(PermissionStatus status) {
    switch (status) {
      case PermissionStatus.denied:
        return BirdCoderPermissionStatus.denied;
      case PermissionStatus.granted:
        return BirdCoderPermissionStatus.granted;
      case PermissionStatus.restricted:
        return BirdCoderPermissionStatus.restricted;
      case PermissionStatus.limited:
        return BirdCoderPermissionStatus.limited;
      case PermissionStatus.permanentlyDenied:
        return BirdCoderPermissionStatus.permanentlyDenied;
      case PermissionStatus.provisional:
        // Treated as denied until the user completes the full grant flow.
        return BirdCoderPermissionStatus.denied;
    }
  }
}
