import 'package:camera/camera.dart';

import 'native_service_error.dart';

/// Result of a camera capture request.
class CameraCaptureResult {
  const CameraCaptureResult({required this.path});

  /// Absolute path to the captured image file.
  final String path;
}

/// Service contract for capturing photos through the device camera.
///
/// Wraps the `camera` plugin behind a typed, testable interface so feature
/// widgets never import plugin classes directly. Implementations expose stable
/// [NativeServiceError] codes for permission, availability, and capture errors.
abstract class CameraService {
  static CameraService? _instance;

  /// Returns the shared [CameraService] singleton.
  factory CameraService() => _instance ??= CameraServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(CameraService service) => _instance = service;

  /// Whether at least one camera is available on this device.
  Future<bool> isAvailable();

  /// Opens the camera and captures a single photo.
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.permissionDenied]
  /// when camera permission is missing, [NativeServiceError.unavailable] when
  /// no camera is present, or [NativeServiceError.failed] on capture errors.
  Future<CameraCaptureResult> capturePhoto();
}

class CameraServiceImpl implements CameraService {
  CameraServiceImpl();

  @override
  Future<bool> isAvailable() async {
    try {
      final cameras = await availableCameras();
      return cameras.isNotEmpty;
    } on Exception {
      return false;
    }
  }

  @override
  Future<CameraCaptureResult> capturePhoto() async {
    List<CameraDescription> cameras;
    try {
      cameras = await availableCameras();
    } on CameraException catch (error) {
      throw NativeServiceException(
        NativeServiceError.unavailable,
        platformMessage: error.code,
      );
    } on Exception {
      throw const NativeServiceException(NativeServiceError.unavailable);
    }

    if (cameras.isEmpty) {
      throw const NativeServiceException(NativeServiceError.unavailable);
    }

    final camera = cameras.firstWhere(
      (description) => description.lensDirection == CameraLensDirection.back,
      orElse: () => cameras.first,
    );

    CameraController controller;
    try {
      controller = CameraController(camera, ResolutionPreset.high);
      await controller.initialize();
    } on CameraException catch (error) {
      if (error.code.contains('permission')) {
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

    try {
      final file = await controller.takePicture();
      return CameraCaptureResult(path: file.path);
    } on CameraException catch (error) {
      if (error.code.contains('cancel')) {
        throw const NativeServiceException(NativeServiceError.cancelled);
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    } finally {
      await controller.dispose();
    }
  }
}
