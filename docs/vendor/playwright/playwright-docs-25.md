---
name: playwright-docs-25
description: "Playwright (GUI-walk driver) — vendor doc 25/30 (docs)"
type: reference
---

## Install behind a firewall or a proxy

By default, Playwright downloads browsers from Microsoft's CDN.

Sometimes companies maintain an internal proxy that blocks direct access to the public
resources. In this case, Playwright can be configured to download browsers via a proxy server.

```bash tab=bash-bash lang=js
HTTPS_PROXY=https://192.0.2.1 npx playwright install
```

```batch tab=bash-batch lang=js
set HTTPS_PROXY=https://192.0.2.1
npx playwright install
```

```powershell tab=bash-powershell lang=js
$Env:HTTPS_PROXY="https://192.0.2.1"
npx playwright install
```

```bash tab=bash-bash lang=python
pip install playwright
HTTPS_PROXY=https://192.0.2.1 playwright install
```

```batch tab=bash-batch lang=python
set HTTPS_PROXY=https://192.0.2.1
pip install playwright
playwright install
```

```powershell tab=bash-powershell lang=python
$Env:HTTPS_PROXY="https://192.0.2.1"
pip install playwright
playwright install
```

```bash tab=bash-bash lang=java
HTTPS_PROXY=https://192.0.2.1 mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```batch tab=bash-batch lang=java
set HTTPS_PROXY=https://192.0.2.1
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```powershell tab=bash-powershell lang=java
$Env:HTTPS_PROXY="https://192.0.2.1"
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```bash tab=bash-bash lang=csharp
HTTPS_PROXY=https://192.0.2.1 pwsh bin/Debug/netX/playwright.ps1 install
```

```batch tab=bash-batch lang=csharp
set HTTPS_PROXY=https://192.0.2.1
pwsh bin/Debug/netX/playwright.ps1 install
```

```powershell tab=bash-powershell lang=csharp
$Env:HTTPS_PROXY="https://192.0.2.1"
pwsh bin/Debug/netX/playwright.ps1 install
```

If the requests of the proxy get intercepted with a custom untrusted certificate authority (CA) and it yields to `Error: self signed certificate in certificate chain` while downloading the browsers, you must set your custom root certificates via the [`NODE_EXTRA_CA_CERTS`](https://nodejs.org/api/cli.html#node_extra_ca_certsfile) environment variable before installing the browsers:

```bash tab=bash-bash
export NODE_EXTRA_CA_CERTS="/path/to/cert.pem"
```

```batch tab=bash-batch
set NODE_EXTRA_CA_CERTS="C:\certs\root.crt"
```

```powershell tab=bash-powershell
$Env:NODE_EXTRA_CA_CERTS="C:\certs\root.crt"
```

If your network is slow to connect to Playwright browser archive, you can increase the connection timeout in milliseconds with `PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT` environment variable:

```bash tab=bash-bash lang=js
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 npx playwright install
```

```batch tab=bash-batch lang=js
set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
npx playwright install
```

```powershell tab=bash-powershell lang=js
$Env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT="120000"
npx playwright install
```

```bash tab=bash-bash lang=python
pip install playwright
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 playwright install
```

```batch tab=bash-batch lang=python
set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
pip install playwright
playwright install
```

```powershell tab=bash-powershell lang=python
$Env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT="120000"
pip install playwright
playwright install
```

```bash tab=bash-bash lang=java
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```batch tab=bash-batch lang=java
set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```powershell tab=bash-powershell lang=java
$Env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT="120000"
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```bash tab=bash-bash lang=csharp
PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 pwsh bin/Debug/netX/playwright.ps1 install
```

```batch tab=bash-batch lang=csharp
set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
pwsh bin/Debug/netX/playwright.ps1 install
```

```powershell tab=bash-powershell lang=csharp
$Env:PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT="120000"
pwsh bin/Debug/netX/playwright.ps1 install
```

If you are [installing dependencies](#install-system-dependencies) and need to use a proxy on Linux, make sure to run the command as a root user. Otherwise, Playwright will attempt to become a root and will not pass environment variables like `HTTPS_PROXY` to the linux package manager.

```bash js
sudo HTTPS_PROXY=https://192.0.2.1 npx playwright install-deps
```

```bash java
sudo HTTPS_PROXY=https://192.0.2.1 mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install-deps"
```

```bash python
sudo HTTPS_PROXY=https://192.0.2.1 playwright install-deps
```

```bash csharp
sudo HTTPS_PROXY=https://192.0.2.1 pwsh bin/Debug/netX/playwright.ps1 install-deps
```
