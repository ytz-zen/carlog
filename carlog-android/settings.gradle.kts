pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradleWrapper()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "CarLog"
include(":app")
