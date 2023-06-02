import { expect, test } from "vitest";
const stringifyT = JSON.stringify;
test("keep send body", async () => {
    const body = stringifyT({ keepMe: "hello" });
    expect(body).toMatchSnapshot();
});
// TODO: msw
