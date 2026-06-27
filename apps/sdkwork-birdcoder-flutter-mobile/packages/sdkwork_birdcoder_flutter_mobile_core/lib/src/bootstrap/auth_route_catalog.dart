const birdCoderAuthBasePath = '/auth';
const birdCoderAuthStorageScope = 'sdkwork-birdcoder.iam';
const birdCoderAuthSessionKey = 'sdkwork.birdcoder.appSession.v1';

enum BirdCoderRouteAuth {
  requiredAuth,
  optional,
  public,
}

class BirdCoderRouteDefinition {
  final String id;
  final String path;
  final String component;
  final BirdCoderRouteAuth auth;

  const BirdCoderRouteDefinition({
    required this.id,
    required this.path,
    required this.component,
    required this.auth,
  });
}

const _birdCoderProductRouteCatalog = <BirdCoderRouteDefinition>[
  BirdCoderRouteDefinition(
    id: 'app.im.chat.index',
    path: '/',
    component: 'ChatPage',
    auth: BirdCoderRouteAuth.requiredAuth,
  ),
  BirdCoderRouteDefinition(
    id: 'app.account.settings.index',
    path: '/settings',
    component: 'SettingsPage',
    auth: BirdCoderRouteAuth.requiredAuth,
  ),
];

List<BirdCoderRouteDefinition> createBirdCoderAuthRouteCatalog([
  String basePath = birdCoderAuthBasePath,
]) {
  final normalizedBasePath = basePath.replaceAll(RegExp(r'/+$'), '');
  return [
    BirdCoderRouteDefinition(
      id: 'app.iam.login.index',
      path: '$normalizedBasePath/login',
      component: 'app.iam.login.index',
      auth: BirdCoderRouteAuth.public,
    ),
    BirdCoderRouteDefinition(
      id: 'app.iam.register.index',
      path: '$normalizedBasePath/register',
      component: 'app.iam.register.index',
      auth: BirdCoderRouteAuth.public,
    ),
    BirdCoderRouteDefinition(
      id: 'app.iam.recovery.index',
      path: '$normalizedBasePath/recovery',
      component: 'app.iam.recovery.index',
      auth: BirdCoderRouteAuth.public,
    ),
    BirdCoderRouteDefinition(
      id: 'app.iam.oauth.callback',
      path: '$normalizedBasePath/oauth/callback',
      component: 'app.iam.oauth.callback',
      auth: BirdCoderRouteAuth.public,
    ),
    BirdCoderRouteDefinition(
      id: 'app.iam.qr.index',
      path: '$normalizedBasePath/qr',
      component: 'app.iam.qr.index',
      auth: BirdCoderRouteAuth.public,
    ),
  ];
}

List<BirdCoderRouteDefinition> createBirdCoderRouteCatalog([
  String basePath = birdCoderAuthBasePath,
]) {
  return [
    ...createBirdCoderAuthRouteCatalog(basePath),
    ..._birdCoderProductRouteCatalog,
  ];
}

bool isBirdCoderAuthRoutePath(String path, [String basePath = birdCoderAuthBasePath]) {
  final normalized = path.replaceAll(RegExp(r'/+$'), '');
  final normalizedBase = basePath.replaceAll(RegExp(r'/+$'), '');
  return normalized == normalizedBase || normalized.startsWith('$normalizedBase/');
}
