import 'dart:async';

import 'package:app_links/app_links.dart';

class BirdCoderDeepLinkAdapter {
  BirdCoderDeepLinkAdapter({AppLinks? appLinks}) : _appLinks = appLinks ?? AppLinks();

  final AppLinks _appLinks;

  Future<Uri?> readInitialUri() {
    return _appLinks.getInitialLink();
  }

  Stream<Uri> watchUriLinks() {
    return _appLinks.uriLinkStream;
  }
}

BirdCoderDeepLinkAdapter? _defaultDeepLinkAdapter;

BirdCoderDeepLinkAdapter getBirdCoderDeepLinkAdapter() {
  return _defaultDeepLinkAdapter ??= BirdCoderDeepLinkAdapter();
}

void configureBirdCoderDeepLinkAdapter(BirdCoderDeepLinkAdapter adapter) {
  _defaultDeepLinkAdapter = adapter;
}
