import java.io.File
import java.util.Properties
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val executable = """npm""";
        try {
            runTauriCli(executable)
        } catch (e: Exception) {
            if (Os.isFamily(Os.FAMILY_WINDOWS)) {
                // Try different Windows-specific extensions
                val fallbacks = listOf(
                    "$executable.exe",
                    "$executable.cmd",
                    "$executable.bat",
                )
                var lastException: Exception = e
                for (fallback in fallbacks) {
                    try {
                        runTauriCli(fallback)
                        return
                    } catch (fallbackException: Exception) {
                        lastException = fallbackException
                    }
                }
                throw lastException
            } else {
                throw e;
            }
        }
    }

    fun runTauriCli(executable: String) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = listOf("run", "--", "tauri", "android", "android-studio-script");
        val androidEnvironment = resolveAndroidBuildEnvironment(target)

        project.exec {
            workingDir(File(project.projectDir, rootDirRel))
            executable(executable)
            args(args)
            environment(androidEnvironment.linker.envName, androidEnvironment.linkerPath.absolutePath)
            environment("ANDROID_NDK_HOME", androidEnvironment.ndkDir.absolutePath)
            environment("NDK_HOME", androidEnvironment.ndkDir.absolutePath)
            if (androidEnvironment.sdkDir != null) {
                environment("ANDROID_HOME", androidEnvironment.sdkDir.absolutePath)
                environment("ANDROID_SDK_ROOT", androidEnvironment.sdkDir.absolutePath)
            }
            if (project.logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (project.logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }

    private fun resolveAndroidBuildEnvironment(target: String): AndroidBuildEnvironment {
        val linker = linkerConfigs[target]
            ?: throw GradleException("Unsupported Android Rust target '$target'")
        val sdkDir = resolveAndroidSdkDir()
        val ndkDir = resolveAndroidNdkDir(sdkDir, linker)
            ?: throw GradleException(
                "Unable to find Android NDK linker '${linker.executableName}' for target '$target'. " +
                    "Set ANDROID_NDK_HOME or configure sdk.dir in local.properties."
            )
        val linkerPath = androidLinkerPath(ndkDir, linker)

        return AndroidBuildEnvironment(
            sdkDir = sdkDir,
            ndkDir = ndkDir,
            linker = linker,
            linkerPath = linkerPath,
        )
    }

    private fun resolveAndroidSdkDir(): File? {
        val envSdkDir = listOf("ANDROID_HOME", "ANDROID_SDK_ROOT")
            .mapNotNull { System.getenv(it)?.takeIf(String::isNotBlank) }
            .map(::File)
            .firstOrNull(File::isDirectory)

        if (envSdkDir != null) {
            return envSdkDir
        }

        val localProperties = project.rootProject.file("local.properties")
        if (!localProperties.isFile) {
            return null
        }

        val properties = Properties()
        localProperties.inputStream().use(properties::load)

        return properties.getProperty("sdk.dir")
            ?.takeIf(String::isNotBlank)
            ?.let(::File)
            ?.takeIf(File::isDirectory)
    }

    private fun resolveAndroidNdkDir(
        sdkDir: File?,
        linker: AndroidLinkerConfig,
    ): File? {
        val envNdkDirs = listOf("ANDROID_NDK_HOME", "NDK_HOME")
            .mapNotNull { System.getenv(it)?.takeIf(String::isNotBlank) }
            .map(::File)

        val discoveredNdkDirs = sdkDir
            ?.resolve("ndk")
            ?.listFiles()
            ?.filter(File::isDirectory)
            ?.sortedByDescending(File::getName)
            ?: emptyList()

        return (envNdkDirs + discoveredNdkDirs)
            .firstOrNull { androidLinkerPath(it, linker).isFile }
    }

    private fun androidLinkerPath(
        ndkDir: File,
        linker: AndroidLinkerConfig,
    ): File {
        return ndkDir
            .resolve("toolchains")
            .resolve("llvm")
            .resolve("prebuilt")
            .resolve(ndkHostTag())
            .resolve("bin")
            .resolve(linker.executableName)
    }

    private fun ndkHostTag(): String {
        return when {
            Os.isFamily(Os.FAMILY_WINDOWS) -> "windows-x86_64"
            Os.isFamily(Os.FAMILY_MAC) -> "darwin-x86_64"
            else -> "linux-x86_64"
        }
    }

    private data class AndroidBuildEnvironment(
        val sdkDir: File?,
        val ndkDir: File,
        val linker: AndroidLinkerConfig,
        val linkerPath: File,
    )

    private data class AndroidLinkerConfig(
        val envName: String,
        val executableName: String,
    )

    companion object {
        private const val ANDROID_API_LEVEL = 24

        private val commandSuffix = if (Os.isFamily(Os.FAMILY_WINDOWS)) ".cmd" else ""

        private val linkerConfigs = mapOf(
            "aarch64" to AndroidLinkerConfig(
                envName = "CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER",
                executableName = "aarch64-linux-android$ANDROID_API_LEVEL-clang$commandSuffix",
            ),
            "armv7" to AndroidLinkerConfig(
                envName = "CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER",
                executableName = "armv7a-linux-androideabi$ANDROID_API_LEVEL-clang$commandSuffix",
            ),
            "i686" to AndroidLinkerConfig(
                envName = "CARGO_TARGET_I686_LINUX_ANDROID_LINKER",
                executableName = "i686-linux-android$ANDROID_API_LEVEL-clang$commandSuffix",
            ),
            "x86_64" to AndroidLinkerConfig(
                envName = "CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER",
                executableName = "x86_64-linux-android$ANDROID_API_LEVEL-clang$commandSuffix",
            ),
        )
    }
}
