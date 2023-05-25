# optools playground

```bash
$ pnpm build
```

## Example

```bash
$ npx @mizchi/optools analyze-dts -i lib/index.d.ts
{
  "reserved": [
    "result",
    "value",
    "pubTypeKey",
    "ikey",
    "xxx",
    "yyy",
    "A-B",
    "publicMethod",
    "PublicModule",
    "nested",
    "y",
    "PublicModuleInterface",
    "publicModuleClassMethod",
    "PublicModuleClass",
    "PublicModuleType",
    "pubModType",
    "pubModConst",
    "__type",
    "append",
    "method",
    "body",
    "headers",
    "text",
    "json",
    "methodType",
    "bodyType",
    "headersType",
    "responseType",
    "searchType",
    "errors",
    "keepMe",
    "ok",
    "http://example.test",
    "/send",
    "Content-Type"
  ],
  "privates": [
    "privateMethod",
    "privateMethod2",
    "privateMethod3",
    "privateMethod4",
    "privateModuleClassMethod"
  ]
}
```