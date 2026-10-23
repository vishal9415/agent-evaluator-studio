import { describe, expect, it } from "vitest";
import { waitForIceGatheringComplete, type IceGatheringPeer } from "./ice-gathering";

class FakeIcePeer implements IceGatheringPeer {
  iceGatheringState: RTCIceGatheringState = "gathering";
  private listeners = new Set<EventListener>();

  addEventListener(_type: "icegatheringstatechange", listener: EventListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "icegatheringstatechange", listener: EventListener) {
    this.listeners.delete(listener);
  }

  completeGathering() {
    this.iceGatheringState = "complete";
    for (const listener of [...this.listeners]) {
      listener(new Event("icegatheringstatechange"));
    }
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

describe("waitForIceGatheringComplete", () => {
  it("returns immediately when ICE gathering is already complete", async () => {
    const peer = new FakeIcePeer();
    peer.completeGathering();
    await expect(waitForIceGatheringComplete(peer)).resolves.toBeUndefined();
  });

  it("waits for the completion event and removes its listener", async () => {
    const peer = new FakeIcePeer();
    const pending = waitForIceGatheringComplete(peer, 100);
    expect(peer.listenerCount).toBe(1);
    peer.completeGathering();
    await expect(pending).resolves.toBeUndefined();
    expect(peer.listenerCount).toBe(0);
  });

  it("fails with an actionable error if ICE gathering never completes", async () => {
    const peer = new FakeIcePeer();
    await expect(waitForIceGatheringComplete(peer, 5)).rejects.toThrow(
      /ICE candidate gathering timed out/i,
    );
    expect(peer.listenerCount).toBe(0);
  });
});
