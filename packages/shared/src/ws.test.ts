import { parseWsServerEvent } from "./ws";

describe("parseWsServerEvent", () => {
	it("ready と、部屋のイベントを読む", () => {
		expect(parseWsServerEvent('{"type":"ready"}')).toEqual({ type: "ready" });
		const event = {
			type: "message.created",
			room: { type: "channel", id: "c1" },
			data: { id: 1 },
		};
		expect(parseWsServerEvent(JSON.stringify(event))).toEqual(event);
	});

	it.each([
		["JSON でない", "not json"],
		["オブジェクトでない", "1"],
		["type が無い", "{}"],
		["部屋が無い", '{"type":"x"}'],
		["知らない部屋の種類", '{"type":"x","room":{"type":"dm","id":"d"}}'],
	])("%s なら null", (_, text) => {
		expect(parseWsServerEvent(text)).toBeNull();
	});
});
