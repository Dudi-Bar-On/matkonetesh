---
name: playwright-docs-30
description: "Playwright (GUI-walk driver) — vendor doc 30/30 (docs)"
type: reference
---

## Publishing report on the web
* langs: js

Downloading the HTML report as a zip file is not very convenient. However, we can utilize Azure Storage's static websites hosting capabilities to easily and efficiently serve HTML reports on the Internet, requiring minimal configuration.

1. Create an [Azure Storage account](https://learn.microsoft.com/en-us/azure/storage/common/storage-account-create).
1. Enable [Static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to#enable-static-website-hosting) for the storage account.
1. Create a Service Principal in Azure and grant it access to Azure Blob storage. Upon successful execution, the command will display the credentials which will be used in the next step.

    ```bash
    az ad sp create-for-rbac --name "github-actions" --role "Storage Blob Data Contributor" --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP_NAME>/providers/Microsoft.Storage/storageAccounts/<STORAGE_ACCOUNT_NAME>
    ```
1. Use the credentials from the previous step to set up encrypted secrets in your GitHub repository. Go to your repository's settings, under [GitHub Actions secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository), and add the following secrets:

    - `AZCOPY_SPA_APPLICATION_ID`
    - `AZCOPY_SPA_CLIENT_SECRET`
    - `AZCOPY_TENANT_ID`

   For a detailed guide on how to authorize a service principal using a client secret, refer to [this Microsoft documentation](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azcopy-authorize-azure-active-directory#authorize-a-service-principal-by-using-a-client-secret).
1. Add a step that uploads the HTML report to Azure Storage.

    ```yaml title=".github/workflows/playwright.yml"
    ...
        - name: Upload HTML report to Azure
          shell: bash
          run: |
            REPORT_DIR='run-${{ github.run_id }}-${{ github.run_attempt }}'
            azcopy cp --recursive "./playwright-report/*" "https://<STORAGE_ACCOUNT_NAME>.blob.core.windows.net/\$web/$REPORT_DIR"
            echo "::notice title=HTML report url::https://<STORAGE_ACCOUNT_NAME>.z1.web.core.windows.net/$REPORT_DIR/index.html"
          env:
            AZCOPY_AUTO_LOGIN_TYPE: SPN
            AZCOPY_SPA_APPLICATION_ID: '${{ secrets.AZCOPY_SPA_APPLICATION_ID }}'
            AZCOPY_SPA_CLIENT_SECRET: '${{ secrets.AZCOPY_SPA_CLIENT_SECRET }}'
            AZCOPY_TENANT_ID: '${{ secrets.AZCOPY_TENANT_ID }}'
    ```

The contents of the `$web` storage container can be accessed from a browser by using the [public URL](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website-how-to?tabs=azure-portal#portal-find-url) of the website.

:::note
This step will not work for pull requests created from a forked repository because such workflow [doesn't have access to the secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#using-secrets-in-a-workflow).
:::

## Properly handling Secrets
* langs: js

Artifacts like trace files, HTML reports or even the console logs contain information about your test execution.
They can contain sensitive data like user credentials for a test user, access tokens to a staging backend, testing source code, or sometimes even your application source code. Treat these files just as carefully as you treat that sensitive data.
If you upload reports and traces as part of your CI workflow, make sure that you only upload them to trusted artifact stores, or that you encrypt the files before upload. The same is true for sharing artifacts with team members: Use a trusted file share or encrypt the files before sharing.

## Properly handling Secrets
* langs: python, java, csharp

Artifacts like trace files or console logs contain information about your test execution.
They can contain sensitive data like user credentials for a test user, access tokens to a staging backend, testing source code, or sometimes even your application source code. Treat these files just as carefully as you treat that sensitive data.
If you upload reports and traces as part of your CI workflow, make sure that you only upload them to trusted artifact stores, or that you encrypt the files before upload. The same is true for sharing artifacts with team members: Use a trusted file share or encrypt the files before sharing.

## What's Next

- [Learn how to use Locators](./locators.md)
- [Learn how to perform Actions](./input.md)
- [Learn how to write Assertions](./test-assertions.md)
- [Learn more about the Trace Viewer](/trace-viewer.md)
- [Learn more ways of running tests on GitHub Actions](/ci.md#github-actions)
- [Learn more about running tests on other CI providers](/ci.md)
