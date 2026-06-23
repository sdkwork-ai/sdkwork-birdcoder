import 'package:sdkwork_common_flutter/sdkwork_common_flutter.dart';
import 'src/http/client.dart';
import 'src/api/intelligence.dart';
import 'src/api/system.dart';
import 'src/api/runtime.dart';
import 'src/api/oauth.dart';
import 'src/api/auth.dart';
import 'src/api/iam.dart';
import 'src/api/templates.dart';
import 'src/api/platform.dart';
import 'src/api/content.dart';
import 'src/api/skills.dart';
import 'src/api/collaboration.dart';
import 'src/api/commerce.dart';

class SdkworkAppClient {
  final HttpClient _httpClient;

  late final IntelligenceApi intelligence;
  late final SystemApi system;
  late final RuntimeApi runtime;
  late final OauthApi oauth;
  late final AuthApi auth;
  late final IamApi iam;
  late final TemplatesApi templates;
  late final PlatformApi platform;
  late final ContentApi content;
  late final SkillsApi skills;
  late final CollaborationApi collaboration;
  late final CommerceApi commerce;

  SdkworkAppClient({
    required SdkConfig config,
  }) : _httpClient = HttpClient(config: config) {
    intelligence = IntelligenceApi(_httpClient);
    system = SystemApi(_httpClient);
    runtime = RuntimeApi(_httpClient);
    oauth = OauthApi(_httpClient);
    auth = AuthApi(_httpClient);
    iam = IamApi(_httpClient);
    templates = TemplatesApi(_httpClient);
    platform = PlatformApi(_httpClient);
    content = ContentApi(_httpClient);
    skills = SkillsApi(_httpClient);
    collaboration = CollaborationApi(_httpClient);
    commerce = CommerceApi(_httpClient);
  }

  factory SdkworkAppClient.withBaseUrl({
    required String baseUrl,
    String? authToken,
    String? accessToken,
    Map<String, String>? headers,
    int timeout = 30000,
  }) {
    return SdkworkAppClient(
      config: SdkConfig(
        baseUrl: baseUrl,
        timeout: timeout,
        headers: headers ?? const {},
        authToken: authToken,
        accessToken: accessToken,
      ),
    );
  }

  void setAuthToken(String token) {
    _httpClient.setAuthToken(token);
  }

  void setAccessToken(String token) {
    _httpClient.setAccessToken(token);
  }

  void setHeader(String key, String value) {
    _httpClient.setHeader(key, value);
  }
}
