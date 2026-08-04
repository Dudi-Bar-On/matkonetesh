---
name: serena-docs-08
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 08/26 (docs)"
type: reference
---

## Configuring Serena to Use the JetBrains Plugin

After installing the plugin, you need to configure Serena to use it.

**Central Configuration**.

You can run

```shell
serena init -b JetBrains
```

to set the default code intelligence backend to JetBrains in the global Serena configuration file.

Alternatively, manually edit the configuration file  `~/.serena/serena_config.yml` 
(`%USERPROFILE%\.serena\serena_config.yml` on Windows) and set

```yaml
language_backend: JetBrains
```

Note that the file might not exist yet if you never executed Serena before.

**Per-Instance Configuration**.
The configuration setting in the global config file can be overridden on a
per-instance basis by providing the arguments `--language-backend JetBrains` when
launching the Serena MCP server.

(per-project-language-backend)=
**Per-Project Configuration**.
You can also set the language backend on a per-project basis in the project's
`.serena/project.yml` file:

```yaml
language_backend: JetBrains
```

If set, this overrides the global `language_backend` setting for the session when the project is
activated at startup (via the `--project` flag).

:::{important}
The language backend is determined once at startup and cannot be changed during a running session.
If a project with a different backend is activated after startup, Serena will return an error.

If you need to work with projects that use different backends, you can either:
1. Use the `--project` flag to activate the project at startup, which will use its configured backend.
2. Configure separate MCP server instances (one per backend) in your client.
:::

**Verifying the Setup**.
You can verify that Serena is using the JetBrains plugin by either checking the dashboard, where
you will see `Languages:
Using JetBrains backend` in the configuration overview.
You will also notice that your client will use the JetBrains-specific tools like `jet_brains_find_symbol` and others like it.

(jetbrains-workflow)=
## Workflow

Having installed the plugin in your IDE and having configured Serena to use the JetBrains backend,
the general workflow is simple:

1. Open the project you want to work on in your JetBrains IDE.  
   Note that the project must be appropriately set up in your IDE, i.e. symbol lookups for all relevant programming languages and frameworks should work in the IDE.  

   You can optionally make Serena open an IDE instance for your project root folder automatically upon project activation, allowing you to skip this step for a project that was previously set up correctly.
   To enable this, configure `jetbrains_launch_command` in [Serena's global configuration file](global-config) appropriately.
2. Activate the project's root folder as a project in Serena (see [Project Creation](project-creation-indexing) and [Project Activation](project-activation)).
3. Start using Serena's tools as usual.

Note that the project folder that is open in your IDE and the Serena project root folder must match.

:::{tip}
If you need to work on multiple projects in the same agent session, create a monorepo folder
containing all the projects and open that folder in both Serena and your IDE.
:::

## Advanced Usage and Configuration

### Using Serena with Multi-Module Projects

JetBrains IDEs support *multi-module projects*, where a project can reference other projects as modules.
Serena, however, requires that a project is self-contained within a single root folder. 
There has to be a one-to-one relationship between the project root folder and the folder that is open in the IDE.

Therefore, to get a multi-module setup working with Serena, the recommended approach is to create a **monorepo folder**,
i.e. a folder that contains all the projects as sub-folders, and open that monorepo folder in both Serena and your IDE.

You do not necessarily need to physically move your projects into a common parent folder; 
you can also use symbolic links to achieve the same effect 
(i.e. use `mklink` on Windows or `ln` on Linux/macOS to link the project folders into a common parent folder).

### Using Serena with Windows Subsystem for Linux (WSL)

JetBrains IDEs have built-in support for WSL, allowing you to run the IDE on Windows while working with code in the WSL environment.
The Serena JetBrains plugin works seamlessly in this setup as well.

#### Using JetBrains Remote Development 

Recommended constellation:
* Your project is in the WSL file system
* Serena is run in WSL (not Windows)
* The IDE has a host component (in WSL) and a client component (on Windows).  
  The Serena JetBrains plugin should normally be **installed in the host** (not the client) for code intelligence to be accessible.

:::{admonition} Plugin Installation Location
:class: note
If the plugin is already installed, check the options on the button for disabling the plugin.
Choose the respective options to ensure the correct installation location (i.e. host, removing it from the client if necessary).
:::

:::{admonition} Using mapped Windows paths in WSL is not recommended!
:class: warning
Keeping your project in the Windows file system and accessing it via `/mnt/` in WSL is extremely slow and not recommended.
:::

**Special Network Setup**.
If you are using a special setup where Serena and the IDE are running on different machines,
make sure Serena can communicate with the JetBrains plugin.
You can configure `jetbrains_plugin_server_address` in your [serena_config.yml](050_configuration) and
configure the listen address of the JetBrains plugin in the IDE via Settings / Tools / Serena
(e.g. set it to 0.0.0.0 to listen on all interfaces, but be aware of the security implications of doing so).

#### Other WSL Integrations (e.g. WSL interpreter) 

* Your project is in the Windows file system
* WSL is used only for running tools (e.g. using a WSL Python interpreter in the IDE)
* Serena, the IDE and the plugin are all running on Windows

In this constellation, no special setup is required.
