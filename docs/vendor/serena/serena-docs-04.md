---
name: serena-docs-04
description: "Serena (LSP MCP: find_symbol / references) — vendor doc 04/26 (docs)"
type: reference
---

html))
* **R**  
  (requires installation of the `languageserver` R package)
* **Rego**  
  (requires the [Regal](https://github.com/open-policy-agent/regal) language server on PATH)
* **Ruby**  
  (by default, uses [ruby-lsp](https://github.com/Shopify/ruby-lsp) (language `ruby`); use language `ruby_solargraph` to use Solargraph instead.)
* **Rust**  
  (requires [rustup](https://rustup.rs/) - uses rust-analyzer from your toolchain)
* **Scala**  
  (requires some [manual setup](../03-special-guides/scala_setup_guide_for_serena); uses Metals LSP)
* **SCSS / Sass / CSS**
  (experimental; requires Node.js + npm; uses [some-sass-language-server](https://github.com/wkillerud/some-sass) to handle
  `.scss`, `.sass`, and `.css`)
* **Solidity**  
  (experimental; requires Node.js and npm; automatically installs `@nomicfoundation/solidity-language-server`;
  works best with a `foundry.toml` or `hardhat.config.js` in the project root)
* **Svelte**
  (requires Node.js v18+ and npm; supports `.svelte` Single File Components plus TypeScript/JavaScript files via `svelte-language-server`; a companion `typescript-language-server` + `typescript-svelte-plugin` is spawned automatically for cross-file rename, go-to-definition, and references across `.ts`/`.js` and `.svelte` files; use language `svelte` for Svelte projects instead of also enabling `typescript`)
* **Swift**
* **SystemVerilog**  
  (uses `verible-verilog-ls`, taken from PATH if present, otherwise version `v0.0-4051-g9fdb4057` is downloaded automatically)
* **Terraform**  
  (uses `terraform-ls` 0.36.5, which Serena downloads automatically; requires Terraform on PATH)
* **TOML**  
  (experimental; uses Taplo 0.10.0, taken from PATH if present, otherwise downloaded automatically)
* **TypeScript**
* **Vue**    
  (3.x with TypeScript; requires Node.js v18+ and npm; supports .vue Single File Components with monorepo detection)
* **YAML**
* **JSON**  
  (experimental; must be explicitly added to the languages list; requires Node.js and npm)
* **Zig**  
  (requires installation of ZLS - Zig Language Server)

Support for further languages can easily be added by providing a shallow adapter for a new language server implementation,
see Serena's [memory on that](https://github.com/oraios/serena/blob/main/.serena/memories/adding_new_language_support_guide.md).
