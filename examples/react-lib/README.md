# react-lib example

To write react components libaries

```bash
# generate lib/index.d.ts
$ pnpm tsc -p . # emit lib/*

# ignore external type like react/jsx-runtime
$ pnpm packelyze analyze-dts -i lib/index.d.ts -o _analyzed.json -e react/jsx-runtime

# build with _analyzed.json
$ pnpm build
```

