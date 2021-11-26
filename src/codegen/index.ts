import * as cg from "./tscodegen";
import ApiGenerator from "./generate";
import ts from "typescript";
import SwaggerParser from "@apidevtools/swagger-parser";
import converter from "swagger2openapi";
import { OpenAPIV3 } from "openapi-types";

export { cg };

export type Opts = {
  include?: string[];
  exclude?: string[];
  optimistic?: boolean;
  ignoreHeader?: string[];
};

export function generateAst(
  name: string,
  spec: OpenAPIV3.Document,
  opts: Opts,
  isConverted: boolean
) {
  return new ApiGenerator(name, spec, opts, isConverted).generateApi();
}

export function printAst(ast: ts.SourceFile) {
  return cg.printFile(ast);
}

export async function generateSource(name: string, spec: string, opts: Opts) {
  let v3Doc;
  const doc = await SwaggerParser.bundle(spec);
  const isOpenApiV3 = "openapi" in doc && doc.openapi.startsWith("3");
  if (isOpenApiV3) {
    v3Doc = doc as OpenAPIV3.Document;
  } else {
    const result = await converter.convertObj(doc, {});
    v3Doc = result.openapi as OpenAPIV3.Document;
  }
  const ast = generateAst(name, v3Doc, opts, !isOpenApiV3);
  const { title, version } = v3Doc.info;
  const preamble = ["$&", title, version].filter(Boolean).join("\n * ");
  const src = printAst(ast);
  return src.replace(/^\/\*\*/, preamble);
}
