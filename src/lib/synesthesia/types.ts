export type Role = "host" | "guest";

export type Utterance = {
  id: string;
  peerId: string;
  name: string;
  text: string;
  start: number;
  end: number;
  interim: boolean;
};

export type Member = {
  id: string;
  name: string;
  role: Role;
};

export type CaptionWire = Utterance & { onset: boolean };

export type SpeechEvent = {
  text: string;
  final: boolean;
  onset: boolean;
};

export type SpeechStatus = {
  engine: "starting" | "deepgram" | "browser" | "unavailable" | "idle";
  detail: string;
};
