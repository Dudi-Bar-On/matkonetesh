---
name: serena-docs-22
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 22/26 (docs)"
type: reference
---

#### Java (`eclipse.jdt.ls`)

Java support has two installation modes:

1. **Default vscode-java VSIX mode** (no extra config required): Serena downloads the platform-specific
   vscode-java VSIX (~500 MB: JDTLS + bundled JRE 21 + Lombok + IntelliCode), Gradle distribution and
   IntelliCode VSIX from public hosts on first use.
2. **Upstream JDTLS mode** (offline-friendly): Activated by setting both `jdtls_path` and `lombok_path`.
   Uses an existing JDTLS installation (~100 MB) and the system JDK 21+. Nothing is downloaded.
   Recommended for restricted-network/corporate environments.

**When to use which mode:**

- **Default vscode-java VSIX mode** — recommended for most users. No setup required;
  Serena downloads everything on first use.
- **Upstream JDTLS mode** — recommended when:
  - you cannot reach `github.com`, `services.gradle.org` or `marketplace.visualstudio.com`
    from the host (corporate proxy, air-gapped network);
  - you want a smaller on-disk footprint (~100 MB vs ~500 MB);
  - you already maintain a JDTLS installation (e.g. for `nvim-jdtls` or another editor);
  - your security policy prohibits per-project runtime downloads.

**JDK 21+ is required** in upstream mode. Serena resolves the JDK in this order:
`ls_specific_settings.java.java_home` → `JAVA_HOME` env var → first `java` on `PATH`.
The resolved JVM is interrogated and rejected if its `java.specification.version` is below 21.

The following settings are supported for the Java language server:

| Setting | Default | Description |
|---|---|---|
| `jdtls_path` | `null` | Activates upstream JDTLS mode. Path to upstream JDTLS root (containing `plugins/` and `config_<platform>/`). Get via `brew install jdtls` or extract `jdt-language-server-*.tar.gz` from <https://download.eclipse.org/jdtls/snapshots/>. Must be set together with `lombok_path`. |
| `lombok_path` | `null` | Path to the Lombok jar. Activates upstream JDTLS mode together with `jdtls_path`. Get from `~/.m2/repository/org/projectlombok/lombok/<ver>/lombok-<ver>.jar` or download from <https://projectlombok.org/downloads/>. |
| `java_home` | `null` | (upstream-jdtls mode only) Path to JDK 21+ home directory used to launch JDTLS. Falls back to `JAVA_HOME` env var, then `which java`. |
| `maven_user_settings` | `~/.m2/settings.xml` | Path to Maven `settings.xml` |
| `gradle_user_home` | `~/.gradle` | Path to Gradle user home directory |
| `gradle_wrapper_enabled` | `false` | Use the project's Gradle wrapper (`gradlew`) instead of the bundled Gradle distribution. Enable this for projects with custom plugins or repositories. |
| `gradle_java_home` | `null` | Path to the JDK used by Gradle. When unset, Gradle uses `JAVA_HOME` if `use_system_java_home` is enabled and `JAVA_HOME` is set; otherwise it falls back to Serena's bundled JRE. |
| `use_system_java_home` | `false` | Use the system's `JAVA_HOME` environment variable for JDTLS itself and, when `gradle_java_home` is unset, Gradle import. Enable this if your project requires a specific JDK vendor or version for Gradle's JDK checks. |
| `runtimes` | `[]` | Extra JRE/JDK entries registered with JDT-LS via `java.configuration.runtimes`. Use this when a project's source/target level exceeds the JDK JDT-LS itself runs on (currently JDK 21 in default vscode-java VSIX mode). Each entry is a mapping with required `name` (e.g. `JavaSE-25`, matching the `JavaSE-NN` container the build tool requests) and `path` (JDK/JRE home directory; must exist), plus optional `default`, `sources`, and `javadoc` (passed through to JDT-LS). Entries extend rather than replace the bundled `JavaSE-21` runtime; an entry that reuses the `JavaSE-21` name overrides the bundled one. Changing this setting invalidates the JDTLS workspace hash so a fresh import is performed. |
| `gradle_version` | `8.14.2` | (vscode-java mode only) Override the Gradle distribution version Serena downloads by default. |
| `vscode_java_version` | `1.54.0-923` | (vscode-java mode only) Override the bundled `vscode-java` runtime bundle version Serena downloads by default. |
| `intellicode_version` | `1.2.30` | (vscode-java mode only) Override the IntelliCode VSIX version Serena downloads by default. |
| `lombok_show_generated` | `true` | Show Lombok-generated methods (`getX/setX`, `builder()`, `equals/hashCode/toString`, `withX`, fluent accessors) in `find_symbol`, `get_symbols_overview` and the symbol-edit tools. Set to `false` to restore the previous JDTLS default and hide the synthetic methods (e.g. when `@Data` classes pollute the outline with too many getters/setters). Requires JDTLS commit `b2d8952` / `vscode-java >= 1.53.0`; the bundled default already meets this. |
| `jdtls_xmx` | `3G` | Maximum heap size for the JDTLS server JVM. |
| `jdtls_xms` | `100m` | Initial heap size for the JDTLS server JVM. |
| `intellicode_xmx` | `1G` | (vscode-java mode only) Maximum heap size for the IntelliCode embedded JVM. |
| `intellicode_xms` | `100m` | (vscode-java mode only) Initial heap size for the IntelliCode embedded JVM. |

Notes:
- When overriding `vscode_java_version`, Serena still assumes that the downloaded runtime bundle keeps the same internal
  directory layout and file names as the bundled default version.
- In upstream-jdtls mode, IntelliCode is not loaded (it's an ML completions ranker that is irrelevant to Serena's
  symbol-tools workflow), and Serena does not ship a Gradle distribution. Maven projects work via JDTLS's bundled m2e.
  Gradle projects must have `./gradlew` in the project, or rely on a system-installed Gradle through Buildship's
  default discovery rules.
- In upstream-jdtls mode the `gradle_version`, `vscode_java_version`, `intellicode_version`,
  `intellicode_xmx`, `intellicode_xms` settings are silently ignored — they only apply to the
  vscode-java VSIX mode.
- Without `runtimes`, JDT-LS only knows about the bundled `JavaSE-21` JRE. Projects that request a newer
  container (e.g. `sourceCompatibility = JavaVersion.VERSION_25`) then fail to resolve JDK types such as
  `java.lang.Object`. Register the matching installed JDK via `runtimes` instead of symlinking over Serena's
  bundled JRE directory.

Example: upstream-jdtls mode (offline / corporate network):

```yaml
ls_specific_settings:
  java:
    jdtls_path: "/opt/homebrew/Cellar/jdtls/1.50.0/libexec"
    lombok_path: "/Users/me/.m2/repository/org/projectlombok/lombok/1.18.38/lombok-1.18.38.jar"
    # java_home: "/opt/homebrew/opt/openjdk@21"  # optional
```

Example: default vscode-java VSIX mode for a project with custom Gradle plugins:

```yaml
ls_specific_settings:
  java:
    gradle_wrapper_enabled: true
    use_system_java_home: true
```

Example: register an additional JDK for a project targeting a newer Java version:

```yaml
ls_specific_settings:
  java:
    runtimes:
      - name: JavaSE-21
        path: /usr/lib/jvm/java-21-openjdk
      - name: JavaSE-25
        path: /home/user/Java/jdk25
        default: true
```
