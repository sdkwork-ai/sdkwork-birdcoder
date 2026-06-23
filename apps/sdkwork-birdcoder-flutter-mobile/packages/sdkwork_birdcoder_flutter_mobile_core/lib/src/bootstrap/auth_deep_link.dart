import 'auth_route_catalog.dart';

String _joinAuthPath(String path, String? query) {
  final normalized = path.replaceAll(RegExp(r'/+$'), '');
  if (query == null || query.isEmpty) {
    return normalized.isEmpty ? '/' : normalized;
  }
  return '$normalized?$query';
}

String? normalizeBirdCoderAuthDeepLinkPath(Uri? uri) {
  if (uri == null) {
    return null;
  }

  final query = uri.hasQuery ? uri.query : null;
  final candidates = <String>{
    _joinAuthPath(uri.path, query),
    if (uri.host.isNotEmpty) _joinAuthPath('/${uri.host}${uri.path}', query),
    if (uri.path.isEmpty && uri.host.isNotEmpty) _joinAuthPath('/${uri.host}', query),
  };

  for (final candidate in candidates) {
    if (isBirdCoderAuthRoutePath(candidate)) {
      return candidate;
    }
  }

  return null;
}
