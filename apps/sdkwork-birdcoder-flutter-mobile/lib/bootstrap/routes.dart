import 'package:sdkwork_birdcoder_flutter_mobile_core/sdkwork_birdcoder_flutter_mobile_core.dart'
    as core;

List<core.BirdCoderRouteDefinition> createBirdCoderAuthRouteCatalog([
  String basePath = core.birdCoderAuthBasePath,
]) {
  return core.createBirdCoderAuthRouteCatalog(basePath);
}

List<core.BirdCoderRouteDefinition> createRoutes([
  String basePath = core.birdCoderAuthBasePath,
]) {
  return core.createBirdCoderRouteCatalog(basePath);
}
