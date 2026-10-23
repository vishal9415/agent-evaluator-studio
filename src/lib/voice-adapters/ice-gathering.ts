/**
 * Wait until the browser has finished gathering ICE candidates before sending
 * the SDP offer to OpenAI. Sending the offer too early can omit candidates and
 * create sessions that negotiate but fail to establish a usable media path.
 */
export interface IceGatheringPeer {
  readonly iceGatheringState: RTCIceGatheringState;
  addEventListener(type: "icegatheringstatechange", listener: EventListener): void;
  removeEventListener(type: "icegatheringstatechange", listener: EventListener): void;
}

export async function waitForIceGatheringComplete(
  peer: IceGatheringPeer,
  timeoutMs = 10_000,
): Promise<void> {
  if (peer.iceGatheringState === "complete") return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      peer.removeEventListener("icegatheringstatechange", onStateChange);
      clearTimeout(timeoutId);
    };
    const onStateChange: EventListener = () => {
      if (peer.iceGatheringState !== "complete" || settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    peer.addEventListener("icegatheringstatechange", onStateChange);
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("ICE candidate gathering timed out. Check your network and retry the voice session."));
    }, Math.max(1, timeoutMs));

    // Close the race where gathering completed between the initial check and
    // listener registration.
    onStateChange(new Event("icegatheringstatechange"));
  });
}
