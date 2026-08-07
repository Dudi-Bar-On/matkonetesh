---
name: 68-values-and-types-index
description: "Neo4j 2026.06.0 — Values and types overview (56/60, cypher)"
type: reference
---

<!-- source: https://github.com/neo4j/docs-cypher/blob/2026.06.0/modules/ROOT/pages/values-and-types/index.adoc -->
<!-- source (raw): https://raw.githubusercontent.com/neo4j/docs-cypher/2026.06.0/modules/ROOT/pages/values-and-types/index.adoc -->
<!-- repo: neo4j/docs-cypher  ref: 2026.06.0 -->
<!-- retrieved: 2026-08-07 -->
<!-- fidelity: VERBATIM — fetched as raw AsciiDoc from GitHub, unmodified except for this header. -->

:description: This section provides an overview of data types in Cypher.
= Values and types

Cypher supports a range of data values.
When writing Cypher queries, it is not possible to declare a data type.
Rather, Cypher will automatically infer the data type of a given value.

More information about the data values and types supported by Cypher can be found in the following sections:

* xref:values-and-types/property-structural-constructed.adoc[]
* xref:values-and-types/boolean-numeric-string.adoc[]
* xref::values-and-types/temporal.adoc[]
* xref:values-and-types/spatial.adoc[]
* xref:values-and-types/lists.adoc[]
* xref:values-and-types/maps.adoc[]
* xref:values-and-types/vector.adoc[] label:new[Introduced in Neo4j 2025.10]
* xref:values-and-types/graph-references.adoc[]
* xref::values-and-types/working-with-null.adoc[]
* xref::values-and-types/casting-data.adoc[]
* xref:values-and-types/ordering-equality-comparison.adoc[]

[TIP]
For information about how to check the type of a value, see xref:expressions/predicates/type-predicate-expressions.adoc[]
