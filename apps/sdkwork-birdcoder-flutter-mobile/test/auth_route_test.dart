import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_birdcoder_flutter_mobile/auth/auth_route.dart';

void main() {
  test('oauth callback query parses provider from deep link path', () {
    final query = parseBirdCoderOAuthCallbackQuery(
      'birdcoder://auth/oauth/callback/github?code=oauth-code-1&state=state-1',
    );

    expect(query.provider, 'github');
    expect(query.code, 'oauth-code-1');
    expect(query.state, 'state-1');
  });

  test('oauth callback route resolves from canonical auth path', () {
    expect(
      resolveBirdCoderAuthSurfaceRoute('/auth/oauth/callback?code=oauth-code-1'),
      BirdCoderAuthSurfaceRoute.oauthCallback,
    );
  });
}
