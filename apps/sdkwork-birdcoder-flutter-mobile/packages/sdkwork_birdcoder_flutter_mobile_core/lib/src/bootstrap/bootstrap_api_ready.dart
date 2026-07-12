import 'dart:async';
import 'dart:io';

import 'bootstrap_server_base_url.dart';

const _defaultApiReadyMaxAttempts = 30;
const _defaultApiReadyRequestTimeoutMs = 800;
const _defaultApiReadyRetryDelayMs = 150;
const _defaultApiReadyPaths = [
  '/readyz',
];

Future<void> waitForBirdCoderApiReady(
  String? apiBaseUrl, {
  int maxAttempts = _defaultApiReadyMaxAttempts,
  List<String> paths = _defaultApiReadyPaths,
  int requestTimeoutMs = _defaultApiReadyRequestTimeoutMs,
  int retryDelayMs = _defaultApiReadyRetryDelayMs,
}) async {
  if (apiBaseUrl == null ||
      apiBaseUrl.isEmpty ||
      !isBirdCoderLocalRuntimeApiBaseUrl(apiBaseUrl)) {
    return;
  }

  final readinessPaths = paths.map((path) => path.trim()).where((path) => path.isNotEmpty).toList();
  if (readinessPaths.isEmpty) {
    return;
  }

  final readinessUrls = readinessPaths
      .map((path) => _buildApiReadyUrl(apiBaseUrl, path))
      .toList(growable: false);
  var lastFailure = 'readiness probe did not complete';

  for (var attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      final responses = await Future.wait(
        readinessUrls.map((url) => _probeReadinessUrl(url, requestTimeoutMs)),
      );

      if (responses.every((response) => response)) {
        return;
      }

      lastFailure = 'readiness endpoint returned an unsuccessful response';
    } catch (_) {
      lastFailure = 'readiness request failed before the local API accepted connections';
    }

    await Future<void>.delayed(Duration(milliseconds: retryDelayMs));
  }

  throw StateError(
    'BirdCoder local API is unavailable at $apiBaseUrl. '
    'Start the BirdCoder server before opening appbase-backed pages. '
    'Last readiness failure: $lastFailure.',
  );
}

String _buildApiReadyUrl(String apiBaseUrl, String path) {
  final base = Uri.parse(apiBaseUrl);
  final normalizedBasePath = base.path == '/' ? '' : base.path.replaceAll(RegExp(r'/+$'), '');
  final normalizedPath = path.startsWith('/') ? path : '/$path';
  return base.replace(path: '$normalizedBasePath$normalizedPath').toString();
}

Future<bool> _probeReadinessUrl(String url, int requestTimeoutMs) async {
  final client = HttpClient();
  try {
    final request = await client.getUrl(Uri.parse(url)).timeout(
          Duration(milliseconds: requestTimeoutMs),
        );
    request.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    final response = await request.close().timeout(
      Duration(milliseconds: requestTimeoutMs),
    );
    return response.statusCode >= 200 && response.statusCode < 300;
  } catch (_) {
    return false;
  } finally {
    client.close(force: true);
  }
}
