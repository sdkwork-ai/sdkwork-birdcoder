import 'dart:convert';

import 'package:dio/dio.dart';

import 'native_service_error.dart';

/// Normalized HTTP response returned by [HttpService].
class HttpResponse {
  const HttpResponse({
    required this.statusCode,
    required this.body,
    required this.headers,
  });

  /// HTTP status code reported by the server.
  final int statusCode;

  /// Decoded response body. String for text payloads, decoded JSON for JSON
  /// payloads, `null` when the response has no body.
  final Object? body;

  /// Response headers keyed by lowercased header name.
  final Map<String, String> headers;
}

/// Service contract for HTTP requests through the `dio` plugin.
///
/// Wraps `dio` behind a typed, testable interface so feature widgets never
/// import plugin classes directly. Implementations expose stable
/// [NativeServiceError] codes for timeouts, network failures, and protocol
/// errors.
abstract class HttpService {
  static HttpService? _instance;

  /// Returns the shared [HttpService] singleton.
  factory HttpService() => _instance ??= HttpServiceImpl();

  /// Replaces the singleton, primarily for tests.
  static void bind(HttpService service) => _instance = service;

  /// Whether the HTTP client can issue requests.
  Future<bool> isAvailable();

  /// Issues an HTTP GET to [url].
  Future<HttpResponse> get(
    String url, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  });

  /// Issues an HTTP POST to [url] with [body].
  Future<HttpResponse> post(
    String url, {
    Object? body,
    Map<String, String>? headers,
  });

  /// Issues an HTTP PUT to [url] with [body].
  Future<HttpResponse> put(
    String url, {
    Object? body,
    Map<String, String>? headers,
  });

  /// Issues an HTTP DELETE to [url].
  Future<HttpResponse> delete(
    String url, {
    Object? body,
    Map<String, String>? headers,
  });

  /// Issues an HTTP PATCH to [url] with [body].
  Future<HttpResponse> patch(
    String url, {
    Object? body,
    Map<String, String>? headers,
  });
}

class HttpServiceImpl implements HttpService {
  HttpServiceImpl({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;

  @override
  Future<bool> isAvailable() => Future.value(true);

  @override
  Future<HttpResponse> get(
    String url, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
  }) =>
      _request(() => _dio.get<void>(
            url,
            queryParameters: queryParameters,
            options: Options(headers: headers),
          ));

  @override
  Future<HttpResponse> post(
    String url, {
    Object? body,
    Map<String, String>? headers,
  }) =>
      _request(() => _dio.post<void>(
            url,
            data: body,
            options: Options(headers: headers),
          ));

  @override
  Future<HttpResponse> put(
    String url, {
    Object? body,
    Map<String, String>? headers,
  }) =>
      _request(() => _dio.put<void>(
            url,
            data: body,
            options: Options(headers: headers),
          ));

  @override
  Future<HttpResponse> delete(
    String url, {
    Object? body,
    Map<String, String>? headers,
  }) =>
      _request(() => _dio.delete<void>(
            url,
            data: body,
            options: Options(headers: headers),
          ));

  @override
  Future<HttpResponse> patch(
    String url, {
    Object? body,
    Map<String, String>? headers,
  }) =>
      _request(() => _dio.patch<void>(
            url,
            data: body,
            options: Options(headers: headers),
          ));

  Future<HttpResponse> _request(
      Future<Response<dynamic>> Function() send) async {
    try {
      final response = await send();
      return _toHttpResponse(response);
    } on DioException catch (error) {
      throw _mapDioException(error);
    } on Exception catch (error) {
      throw NativeServiceException(
        NativeServiceError.failed,
        platformMessage: error.toString(),
      );
    }
  }

  HttpResponse _toHttpResponse(Response<dynamic> response) {
    final headers = <String, String>{};
    response.headers.map.forEach((key, values) {
      if (values.isNotEmpty) {
        headers[key.toLowerCase()] = values.first;
      }
    });

    final contentType = headers['content-type'] ?? '';
    Object? body = response.data;
    if (body is String && contentType.contains('application/json')) {
      try {
        body = jsonDecode(body);
      } on FormatException {
        // Keep the raw string when JSON parsing fails.
      }
    }
    return HttpResponse(
      statusCode: response.statusCode ?? 0,
      body: body,
      headers: headers,
    );
  }

  NativeServiceException _mapDioException(DioException error) {
    final response = error.response;
    if (response != null && response.statusCode != null) {
      // Surface server-side protocol errors through the same response shape.
      return NativeServiceException(
        NativeServiceError.failed,
        platformMessage: 'HTTP ${response.statusCode}',
      );
    }
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const NativeServiceException(NativeServiceError.timeout);
      case DioExceptionType.connectionError:
        return const NativeServiceException(NativeServiceError.unavailable);
      case DioExceptionType.cancel:
        return const NativeServiceException(NativeServiceError.cancelled);
      case DioExceptionType.badCertificate:
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        return NativeServiceException(
          NativeServiceError.failed,
          platformMessage: error.toString(),
        );
    }
  }
}
