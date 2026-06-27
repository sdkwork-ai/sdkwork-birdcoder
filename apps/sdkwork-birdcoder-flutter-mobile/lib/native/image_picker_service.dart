import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import 'native_service_error.dart';

/// Source for picking an image.
enum BirdCoderImageSource {
  /// Device camera.
  camera,

  /// Photo gallery.
  gallery,
}

/// Result of an image pick request.
class ImagePickResult {
  const ImagePickResult({required this.path, this.bytes});

  /// Absolute path to the picked image, when available on the platform.
  final String? path;

  /// Raw bytes for the picked image, populated on web where no file path exists.
  final List<int>? bytes;
}

/// Service contract for selecting images through the device camera or gallery.
///
/// Wraps the `image_picker` plugin behind a typed, testable interface so
/// feature widgets never import plugin classes directly. Implementations
/// expose stable [NativeServiceError] codes for permission, availability, and
/// cancellation errors.
abstract class ImagePickerService {
  static ImagePickerService? _instance;

  /// Returns the shared [ImagePickerService] singleton.
  factory ImagePickerService() => _instance ??= ImagePickerServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(ImagePickerService service) => _instance = service;

  /// Whether image selection is supported on this device.
  Future<bool> isAvailable();

  /// Picks a single image from [source] (camera or gallery).
  ///
  /// Throws [NativeServiceException] with [NativeServiceError.permissionDenied]
  /// when access is denied, [NativeServiceError.cancelled] when the user
  /// dismisses the picker, or [NativeServiceError.failed] on other errors.
  Future<ImagePickResult> pickImage({
    required BirdCoderImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
  });
}

class ImagePickerServiceImpl implements ImagePickerService {
  ImagePickerServiceImpl();

  @override
  Future<bool> isAvailable() => Future.value(true);

  @override
  Future<ImagePickResult> pickImage({
    required BirdCoderImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
  }) async {
    final pluginSource = source == BirdCoderImageSource.camera
        ? ImageSource.camera
        : ImageSource.gallery;

    try {
      final file = await ImagePicker().pickImage(
        source: pluginSource,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: imageQuality,
      );
      if (file == null) {
        throw const NativeServiceException(NativeServiceError.cancelled);
      }
      return ImagePickResult(path: file.path, bytes: await file.readAsBytes());
    } on PlatformException catch (error) {
      if (error.code.contains('permission') || error.code.contains('denied')) {
        throw NativeServiceException(
          NativeServiceError.permissionDenied,
          platformMessage: error.code,
        );
      }
      if (error.code.contains('cancel')) {
        throw const NativeServiceException(NativeServiceError.cancelled);
      }
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.code,
      );
    } on NativeServiceException {
      rethrow;
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }
}
