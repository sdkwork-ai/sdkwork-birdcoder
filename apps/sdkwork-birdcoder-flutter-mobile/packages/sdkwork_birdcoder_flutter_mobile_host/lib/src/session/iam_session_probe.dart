import 'dart:async';
import 'dart:io';

bool isBirdCoderLocalRuntimeApiBaseUrl(String apiBaseUrl) {
  final parsed = Uri.tryParse(apiBaseUrl);
  if (parsed == null) {
    return false;
  }

  const localHosts = {'localhost', '127.0.0.1', '::1'};
  return localHosts.contains(parsed.host);
}

Future<bool> probeBirdCoderIamSession({
  required String apiBaseUrl,
  required String accessToken,
  int requestTimeoutMs = 800,
}) async {
  if (accessToken.isEmpty) {
    return false;
  }

  final base = Uri.parse(apiBaseUrl);
  final normalizedBasePath = base.path == '/' ? '' : base.path.replaceAll(RegExp(r'/+$'), '');
  final url = base.replace(
    path: '$normalizedBasePath/app/v3/api/system/iam/runtime',
  );

  final client = HttpClient();
  try {
    final request = await client
        .getUrl(url)
        .timeout(Duration(milliseconds: requestTimeoutMs));
    request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $accessToken');
    request.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    final response = await request.close().timeout(
      Duration(milliseconds: requestTimeoutMs),
    );
    return response.statusCode >= 200 && response.statusCode < 300;
  } catch (_) {
    if (isBirdCoderLocalRuntimeApiBaseUrl(apiBaseUrl)) {
      return false;
    }
    // Remote deployments may not expose runtime metadata during bootstrap gaps.
    return true;
  } finally {
    client.close(force: true);
  }
}
