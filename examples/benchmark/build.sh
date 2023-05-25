pnpm tsc -p .
pnpm optools analyze-dts -i lib/hono.d.ts -o _analyzed-hono.json
pnpm optools analyze-dts -i lib/hono-usage.d.ts -o _analyzed-hono-usage.json
pnpm optools analyze-dts -i lib/react-library.d.ts -o _analyzed-react-library.json -e react/jsx-runtime
pnpm optools analyze-dts -i lib/zod-usage.d.ts -o _analyzed-zod-usage.json
pnpm optools analyze-dts -i lib/typescript.d.ts -o _analyzed-typescript.json

# pnpm optools analyze-dts -i lib/jquery.d.ts -o _analyzed-jquery.json
