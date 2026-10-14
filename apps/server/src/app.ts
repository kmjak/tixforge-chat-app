import type { HealthResponse } from "@chat-app/shared";
import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (c) => c.json<HealthResponse>({ status: "ok" }));
