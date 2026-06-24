plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.sdkwork.sdkwork_birdcoder_flutter_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.sdkwork.birdcoder.mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            val releaseStoreFile = providers.gradleProperty("BIRDCODER_ANDROID_RELEASE_STORE_FILE")
            val releaseStorePassword = providers.gradleProperty("BIRDCODER_ANDROID_RELEASE_STORE_PASSWORD")
            val releaseKeyAlias = providers.gradleProperty("BIRDCODER_ANDROID_RELEASE_KEY_ALIAS")
            val releaseKeyPassword = providers.gradleProperty("BIRDCODER_ANDROID_RELEASE_KEY_PASSWORD")
            if (
                releaseStoreFile.isPresent
                && releaseStorePassword.isPresent
                && releaseKeyAlias.isPresent
                && releaseKeyPassword.isPresent
            ) {
                signingConfig = signingConfigs.create("release") {
                    storeFile = file(releaseStoreFile.get())
                    storePassword = releaseStorePassword.get()
                    keyAlias = releaseKeyAlias.get()
                    keyPassword = releaseKeyPassword.get()
                }
            } else {
                signingConfig = signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}
