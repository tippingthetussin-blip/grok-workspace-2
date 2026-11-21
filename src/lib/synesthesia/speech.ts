import type { SpeechEvent, SpeechStatus } from "./types";

type Handle = { dead: boolean; stop: () => void };

type RecResult = { isFinal: boolean; 0?: { transcript?: string } };

type RecEvent = {
  resultIndex: number;
  results: ArrayLike<RecResult>;
};

type BrowserRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: RecEvent) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recCtor(): (new () => BrowserRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRec;
    webkitSpeechRecognition?: new () => BrowserRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function startBrowser(
  onEvent: (event: SpeechEvent) => void,
  onStatus: (status: SpeechStatus) => void,
  handle: Handle,
): () => void {
  if (handle.dead) return () => {};
  const Ctor = recCtor();
  if (!Ctor) {
    onStatus({
      engine: "unavailable",
      detail: "This browser has no built-in speech recognition. Add a Deepgram key, or type the line.",
    });
    return () => {};
  }

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  let phrase = false;
  let stopped = false;
  let restarts = 0;

  rec.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (result?.isFinal) finalText += text;
      else interim += text;
    }
    if (finalText.trim()) {
      onEvent({ text: finalText.trim(), final: true, onset: !phrase });
      phrase = false;
      return;
    }
    if (interim.trim()) {
      onEvent({ text: interim.trim(), final: false, onset: !phrase });
      phrase = true;
    }
  };

  rec.onerror = (event) => {
    const code = event.error ?? "";
    if (code === "aborted" || code === "no-speech") return;
    if (code === "not-allowed" || code === "service-not-allowed") {
      stopped = true;
      onStatus({
        engine: "unavailable",
        detail: "Microphone is blocked. Allow it in Chrome, or type the line instead.",
      });
    }
  };

  rec.onend = () => {
    if (stopped || handle.dead) return;
    restarts += 1;
    if (restarts > 40) {
      onStatus({
        engine: "unavailable",
        detail: "Speech recognition stopped. Tap the mic again, or type the line.",
      });
      return;
    }
    try {
      rec.start();
    } catch {
      /* already running */
    }
  };

  try {
    rec.start();
    onStatus({
      engine: "browser",
      detail: "Using this phone's speech recognition. Add a Deepgram key for punctuation and noise filtering.",
    });
  } catch {
    onStatus({
      engine: "unavailable",
      detail: "Couldn't start the microphone. You can still type.",
    });
  }

  return () => {
    stopped = true;
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}

function startDeepgram(
  key: string,
  onEvent: (event: SpeechEvent) => void,
  onStatus: (status: SpeechStatus) => void,
  handle: Handle,
): () => void {
  let closed = false;
  let fellBack = false;
  let recorder: MediaRecorder | null = null;
  let socket: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let phrase = false;

  const cleanup = () => {
    closed = true;
    try {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "CloseStream" }));
      }
    } catch {
      /* ignore */
    }
    try {
      recorder?.stop();
    } catch {
      /* ignore */
    }
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    stream?.getTracks().forEach((track) => track.stop());
    recorder = null;
    socket = null;
    stream = null;
  };

  const failToBrowser = () => {
    if (handle.dead || fellBack || closed) return;
    fellBack = true;
    cleanup();
    onStatus({
      engine: "browser",
      detail: "Deepgram didn't connect. Using this phone's speech recognition.",
    });
    handle.stop = startBrowser(onEvent, onStatus, handle);
  };

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      failToBrowser();
      return;
    }
    if (handle.dead) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    if (!mime) {
      failToBrowser();
      return;
    }

    const url =
      "wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&smart_format=true&interim_results=true&endpointing=300&vad_events=true&utterance_end_ms=1000";

    try {
      socket = new WebSocket(url, ["token", key]);
    } catch {
      failToBrowser();
      return;
    }

    socket.onopen = () => {
      if (handle.dead || !stream) return;
      onStatus({ engine: "deepgram", detail: "Deepgram Nova-2 is listening." });
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        failToBrowser();
        return;
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0 || socket?.readyState !== WebSocket.OPEN) return;
        void event.data.arrayBuffer().then((buf) => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(buf);
        });
      };
      recorder.start(250);
    };

    socket.onmessage = (event) => {
      let msg: {
        type?: string;
        is_final?: boolean;
        speech_final?: boolean;
        channel?: { alternatives?: { transcript?: string }[] };
      };
      try {
        msg = JSON.parse(String(event.data)) as typeof msg;
      } catch {
        return;
      }
      if (msg.type === "SpeechStarted") {
        phrase = false;
        return;
      }
      if (msg.type && msg.type !== "Results") return;
      const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
      if (!text) return;
      const final = Boolean(msg.is_final || msg.speech_final);
      onEvent({ text, final, onset: !phrase });
      phrase = !final;
    };

    socket.onerror = () => failToBrowser();
    socket.onclose = () => {
      if (!fellBack && !closed && !handle.dead) failToBrowser();
    };
  })();

  return () => {
    fellBack = true;
    cleanup();
  };
}

export function startListening(opts: {
  deepgramKey: string;
  onEvent: (event: SpeechEvent) => void;
  onStatus: (status: SpeechStatus) => void;
}): () => void {
  const handle: Handle = { dead: false, stop: () => {} };
  opts.onStatus({ engine: "starting", detail: "Starting the microphone." });
  const key = opts.deepgramKey.trim();
  handle.stop = key
    ? startDeepgram(key, opts.onEvent, opts.onStatus, handle)
    : startBrowser(opts.onEvent, opts.onStatus, handle);
  return () => {
    handle.dead = true;
    handle.stop();
    opts.onStatus({ engine: "idle", detail: "" });
  };
}
