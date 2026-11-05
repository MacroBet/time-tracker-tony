import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectMp4Evidence,
  maybeMp4Evidence,
  VideoEvidenceError,
  MAX_VIDEO_EVIDENCE_BYTES,
} from "../src/lib/video-evidence";

const uint = (value: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value);
  return b;
};
const box = (type: string, ...parts: Uint8Array[]) => {
  const content = Buffer.concat(parts);
  return Buffer.concat([uint(content.length + 8), Buffer.from(type), content]);
};
const full = (type: string, ...parts: Uint8Array[]) =>
  box(type, Buffer.alloc(4), ...parts);
interface Options {
  seconds?: number;
  sampleTicks?: number;
  movieTicks?: number;
  chunkOffset?: number;
  codec?: string;
  edit?: boolean;
  fragment?: boolean;
  external?: boolean;
  compositionOffset?: number;
  duplicateMovieHeader?: boolean;
  sampleCount?: number;
  audio?: boolean;
  audioObjectType?: number;
}
function fixture(options: Options = {}): Buffer {
  const ticks = Math.round((options.seconds ?? 1) * 1000);
  const movie = Buffer.alloc(100);
  movie.writeUInt32BE(1000, 12);
  movie.writeUInt32BE(options.movieTicks ?? ticks, 16);
  const track = Buffer.alloc(84);
  track[3] = 1;
  track.writeUInt32BE(1, 12);
  track.writeUInt32BE(ticks, 20);
  const media = Buffer.alloc(24);
  media.writeUInt32BE(1000, 12);
  media.writeUInt32BE(ticks, 16);
  const handler = Buffer.alloc(24);
  handler.write("vide", 8);
  const visual = Buffer.alloc(78);
  visual.writeUInt16BE(1, 6);
  visual.writeUInt16BE(64, 24);
  visual.writeUInt16BE(64, 26);
  const avcc = box(
    "avcC",
    Buffer.from([
      1, 66, 0, 30, 255, 225, 0, 4, 0x67, 66, 0, 30, 1, 0, 2, 0x68, 0,
    ]),
  );
  const ftyp = box("ftyp", Buffer.from("isom"), uint(0), Buffer.from("isom"));
  const makeMovie = (offset: number) => {
    const tables = box(
      "stbl",
      full("stsd", uint(1), box(options.codec ?? "avc1", visual, avcc)),
      full("stts", uint(1), uint(1), uint(options.sampleTicks ?? ticks)),
      full("stsc", uint(1), uint(1), uint(1), uint(1)),
      full("stsz", uint(4), uint(options.sampleCount ?? 1)),
      full("stco", uint(1), uint(options.chunkOffset ?? offset)),
      ...(options.compositionOffset === undefined
        ? []
        : [full("ctts", uint(1), uint(1), uint(options.compositionOffset))]),
    );
    const dref = full(
      "dref",
      uint(1),
      box("url ", uint(options.external ? 0 : 1)),
    );
    const mdia = box(
      "mdia",
      box("mdhd", media),
      box("hdlr", handler),
      box("minf", box("dinf", dref), tables),
    );
    const trak = box(
      "trak",
      box("tkhd", track),
      ...(options.edit ? [box("edts", full("elst", uint(0)))] : []),
      mdia,
    );
    const audioHeader = Buffer.alloc(28);
    audioHeader.writeUInt16BE(1, 6);
    const decoder = Buffer.alloc(13);
    decoder[0] = options.audioObjectType ?? 0x40;
    decoder[1] = 0x15;
    const descriptor = (tag: number, value: Buffer) =>
      Buffer.concat([Buffer.from([tag, value.length]), value]);
    const es = descriptor(
      3,
      Buffer.concat([
        Buffer.from([0, 2, 0]),
        descriptor(
          4,
          Buffer.concat([decoder, descriptor(5, Buffer.from([0x12, 0x10]))]),
        ),
      ]),
    );
    const audioTrack = Buffer.from(track);
    audioTrack.writeUInt32BE(2, 12);
    const audioHandler = Buffer.from(handler);
    audioHandler.write("soun", 8);
    const audio = box(
      "trak",
      box("tkhd", audioTrack),
      box(
        "mdia",
        box("mdhd", media),
        box("hdlr", audioHandler),
        box(
          "minf",
          box("dinf", dref),
          box(
            "stbl",
            full("stsd", uint(1), box("mp4a", audioHeader, full("esds", es))),
            full("stts", uint(1), uint(1), uint(ticks)),
            full("stsc", uint(1), uint(1), uint(1), uint(1)),
            full("stsz", uint(4), uint(1)),
            full("stco", uint(1), uint(offset + 4)),
          ),
        ),
      ),
    );
    return box(
      "moov",
      box("mvhd", movie),
      ...(options.duplicateMovieHeader ? [box("mvhd", movie)] : []),
      ...(options.fragment ? [full("mvex")] : []),
      trak,
      ...(options.audio ? [audio] : []),
    );
  };
  const draft = makeMovie(0),
    moov = makeMovie(ftyp.length + draft.length + 8);
  return Buffer.concat([
    ftyp,
    moov,
    box("mdat", Buffer.alloc(options.audio ? 8 : 4)),
  ]);
}

test("restricted MP4 container accepts coherent sample timing through30seconds without trusting request metadata", () => {
  assert(maybeMp4Evidence(fixture()));
  assert.deepEqual(inspectMp4Evidence(fixture({ seconds: 30 })), {
    mime: "video/mp4",
    extension: "mp4",
    durationSeconds: 30,
    videoCodec: "avc1",
  });
  assert.throws(
    () => inspectMp4Evidence(fixture({ seconds: 30.001 })),
    /30 seconds/,
  );
  assert.throws(
    () => inspectMp4Evidence(fixture({ seconds: 1, sampleTicks: 31000 })),
    /sample timings/,
  );
  assert.throws(
    () => inspectMp4Evidence(fixture({ seconds: 1, movieTicks: 31000 })),
    /30 seconds/,
  );
  assert.throws(
    () => inspectMp4Evidence(fixture({ seconds: 2, movieTicks: 1000 })),
    /inconsistent/,
  );
});

test("rejects missing media bytes, sample-count mismatch, ambiguous tracks and duration-changing structures", () => {
  for (const options of [
    { chunkOffset: 0 },
    { sampleCount: 2 },
    { duplicateMovieHeader: true },
    { edit: true },
    { fragment: true },
    { external: true },
    { compositionOffset: 1 },
    { codec: "hvc1" },
  ]) {
    assert.throws(
      () => inspectMp4Evidence(fixture(options)),
      VideoEvidenceError,
      JSON.stringify(options),
    );
  }
  assert.equal(
    inspectMp4Evidence(fixture({ compositionOffset: 0 })).durationSeconds,
    1,
  );
});

test("AAC-LC audio is accepted only with a verified audio track and decoder profile", () => {
  assert.equal(inspectMp4Evidence(fixture({ audio: true })).audioCodec, "mp4a");
  assert.throws(
    () => inspectMp4Evidence(fixture({ audio: true, audioObjectType: 0x6b })),
    /AAC-LC/,
  );
});

test("size, magic, oversized box length and every truncation are rejected with controlled errors", () => {
  assert.throws(
    () => inspectMp4Evidence(new Uint8Array(MAX_VIDEO_EVIDENCE_BYTES + 1)),
    /2 MB/,
  );
  assert.throws(
    () => inspectMp4Evidence(Buffer.from("video/mp4")),
    VideoEvidenceError,
  );
  assert(!maybeMp4Evidence(Buffer.from("video/mp4")));
  const valid = fixture();
  const oversized = Buffer.from(valid);
  oversized.writeUInt32BE(0xfffffff0, 0);
  assert.throws(() => inspectMp4Evidence(oversized), VideoEvidenceError);
  for (let length = 0; length < valid.length; length++)
    assert.throws(
      () => inspectMp4Evidence(valid.subarray(0, length)),
      VideoEvidenceError,
      `length${length}`,
    );
});

test("64-bit boxes exceeding integer precision and zero-size non-media boxes do not reach unsafe reads", () => {
  const extended = Buffer.concat([
    uint(1),
    Buffer.from("ftyp"),
    Buffer.alloc(8, 255),
  ]);
  assert.throws(() => inspectMp4Evidence(extended), VideoEvidenceError);
  const zero = fixture();
  zero.writeUInt32BE(0, 0);
  assert.throws(() => inspectMp4Evidence(zero), VideoEvidenceError);
});
