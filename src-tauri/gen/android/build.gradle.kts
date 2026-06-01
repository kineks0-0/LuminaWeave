buildscript {
    repositories {
        google()
//        maven (
//          url = "https://maven.aliyun.com/repository/public/"
//        )
//        maven (
//          url = "https://maven.aliyun.com/repository/central"
//        )
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.11.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.20")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

tasks.register("clean").configure {
    delete("build")
}
