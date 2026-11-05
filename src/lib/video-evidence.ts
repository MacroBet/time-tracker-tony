/** Restricted ISO BMFF MP4 evidence. No codec decoding or external process runs. */
export const MAX_VIDEO_EVIDENCE_BYTES = 2 * 1024 * 1024;
export const MAX_VIDEO_EVIDENCE_SECONDS = 30;
export class VideoEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoEvidenceError";
  }
}
export interface Mp4Evidence {
  mime: "video/mp4";
  extension: "mp4";
  durationSeconds: number;
  videoCodec: "avc1";
  audioCodec?: "mp4a";
}
type Box = { type: string; data: number; end: number };
const fail = (
  message = "This MP4 cannot be verified. Export a standard H.264 MP4 without edits or fragmentation.",
): never => {
  throw new VideoEvidenceError(message);
};

/** Recognition only. A positive result still requires inspectMp4Evidence. */
export function maybeMp4Evidence(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp"
  );
}

export function inspectMp4Evidence(bytes: Uint8Array): Mp4Evidence {
  if (!bytes.length || bytes.length > MAX_VIDEO_EVIDENCE_BYTES)
    fail("MP4 evidence must be no larger than 2 MB.");
  if (!maybeMp4Evidence(bytes)) fail("Choose a standard MP4 video.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let boxCount = 0;
  const u16 = (offset: number) => view.getUint16(offset);
  const u32 = (offset: number) => view.getUint32(offset);
  const text = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));
  const bound = (offset: number, length: number, end: number) => {
    if (offset < 0 || length < 0 || offset + length > end)
      fail("The MP4 is truncated or has invalid box lengths.");
  };
  const u64 = (offset: number) => {
    const value = view.getBigUint64(offset);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail();
    return Number(value);
  };
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start < end) {
      if (++boxCount > 4096) fail("This MP4 has too many nested records.");
      bound(start, 8, end);
      const type = text(start + 4);
      let length = u32(start),
        header = 8;
      if (length === 1) {
        bound(start, 16, end);
        length = u64(start + 8);
        header = 16;
      }
      if (length === 0) {
        if (type !== "mdat") fail();
        length = end - start;
      }
      if (length < header || length > end - start)
        fail("The MP4 is truncated or has invalid box lengths.");
      result.push({ type, data: start + header, end: start + length });
      start += length;
    }
    return result;
  }
  const one = (items: Box[], type: string) => {
    const found = items.filter((box) => box.type === type);
    if (found.length !== 1) fail(`The MP4 needs exactly one ${type} record.`);
    return found[0];
  };
  const full = (box: Box, minimum: number, versions = [0]) => {
    bound(box.data, minimum, box.end);
    if (!versions.includes(bytes[box.data])) fail();
  };
  const timed = (box: Box, movie = false) => {
    full(box, 24, [0, 1]);
    const version = bytes[box.data];
    bound(box.data, movie ? (version ? 112 : 100) : version ? 36 : 24, box.end);
    const scale = u32(box.data + (version ? 20 : 12));
    const ticks = version ? u64(box.data + 24) : u32(box.data + 16);
    if (!scale || scale > 1_000_000_000 || !ticks) fail();
    if (ticks > MAX_VIDEO_EVIDENCE_SECONDS * scale)
      fail("Choose an MP4 no longer than 30 seconds.");
    return { scale, ticks, seconds: ticks / scale };
  };
  const top = boxes(0, bytes.length);
  const ftyp = one(top, "ftyp");
  bound(ftyp.data, 8, ftyp.end);
  if (
    (ftyp.end - ftyp.data) % 4 ||
    !["isom", "iso2", "mp41", "mp42", "avc1"].includes(text(ftyp.data))
  )
    fail(
      "Use an H.264 MP4 file; MOV, WebM and fragmented MP4 are not supported.",
    );
  if (
    top.some(
      (box) =>
        !["ftyp", "moov", "mdat", "free", "skip", "wide"].includes(box.type),
    )
  )
    fail();
  const media = top.filter((box) => box.type === "mdat");
  if (!media.length) fail("The MP4 has no media samples.");
  const movie = boxes(one(top, "moov").data, one(top, "moov").end);
  if (movie.some((box) => box.type === "mvex" || box.type === "cmov")) fail();
  const movieTime = timed(one(movie, "mvhd"), true);
  const tracks = movie.filter((box) => box.type === "trak");
  if (!tracks.length || tracks.length > 2)
    fail("Use one video track and optionally one AAC audio track.");
  const kinds: string[] = [],
    ids = new Set<number>(),
    ranges: { start: number; end: number }[] = [];
  let maximumTrackTime = 0;
  for (const track of tracks) {
    const parts = boxes(track.data, track.end);
    if (parts.some((box) => ["edts", "tref"].includes(box.type)))
      fail(
        "MP4 edit lists are not supported. Export a standard MP4 without edits.",
      );
    const tkhd = one(parts, "tkhd");
    full(tkhd, 84, [0, 1]);
    const version = bytes[tkhd.data];
    bound(tkhd.data, version ? 96 : 84, tkhd.end);
    if (!(bytes[tkhd.data + 3] & 1)) fail();
    const id = u32(tkhd.data + (version ? 20 : 12));
    if (!id || ids.has(id)) fail();
    ids.add(id);
    const trackTicks = version ? u64(tkhd.data + 28) : u32(tkhd.data + 20);
    if (
      !trackTicks ||
      trackTicks > MAX_VIDEO_EVIDENCE_SECONDS * movieTime.scale
    )
      fail("Choose an MP4 no longer than 30 seconds.");
    maximumTrackTime = Math.max(maximumTrackTime, trackTicks / movieTime.scale);
    const mdia = one(parts, "mdia"),
      mdiaParts = boxes(mdia.data, mdia.end);
    const mediaTime = timed(one(mdiaParts, "mdhd"));
    if (
      Math.abs(trackTicks / movieTime.scale - mediaTime.seconds) >
      Math.max(1 / movieTime.scale, 1 / mediaTime.scale)
    )
      fail("The MP4 has inconsistent track durations.");
    const handler = one(mdiaParts, "hdlr");
    full(handler, 24);
    const kind = text(handler.data + 8);
    if (!["vide", "soun"].includes(kind) || kinds.includes(kind))
      fail("Use one H.264 video track and optionally one AAC audio track.");
    kinds.push(kind);
    const minf = one(mdiaParts, "minf"),
      minfParts = boxes(minf.data, minf.end);
    const dinf = one(minfParts, "dinf"),
      dref = one(boxes(dinf.data, dinf.end), "dref");
    full(dref, 8);
    const refs = boxes(dref.data + 8, dref.end);
    if (
      u32(dref.data + 4) !== 1 ||
      refs.length !== 1 ||
      refs[0].type !== "url "
    )
      fail("External media references are not supported.");
    full(refs[0], 4);
    if (u32(refs[0].data) !== 1 || refs[0].end - refs[0].data !== 4)
      fail("External media references are not supported.");
    const stbl = one(minfParts, "stbl"),
      tables = boxes(stbl.data, stbl.end);
    if (
      tables.some((box) => ["stz2", "senc", "saiz", "saio"].includes(box.type))
    )
      fail();
    // AAC roll recovery groups describe random access, not presentation timing.
    for (const group of tables.filter(
      (box) => box.type === "sbgp" || box.type === "sgpd",
    )) {
      full(group, 12, [0, 1]);
      if (kind !== "soun" || !["roll", "prol"].includes(text(group.data + 4)))
        fail();
    }
    const composition = tables.filter((box) => box.type === "ctts");
    if (composition.length > 1) fail();
    let compositionSamples: number | undefined;
    for (const ctts of composition) {
      full(ctts, 8, [0, 1]);
      const count = u32(ctts.data + 4);
      bound(ctts.data + 8, count * 8, ctts.end);
      if (ctts.data + 8 + count * 8 !== ctts.end) fail();
      compositionSamples = 0;
      for (let index = 0; index < count; index++) {
        compositionSamples += u32(ctts.data + 8 + index * 8);
        if (u32(ctts.data + 12 + index * 8) !== 0)
          fail(
            "MP4 frame reordering is not supported. Export H.264 MP4 without B-frames.",
          );
      }
    }
    const stsd = one(tables, "stsd");
    full(stsd, 8);
    const descriptions = boxes(stsd.data + 8, stsd.end);
    if (u32(stsd.data + 4) !== 1 || descriptions.length !== 1) fail();
    const description = descriptions[0];
    bound(description.data, 8, description.end);
    if (u16(description.data + 6) !== 1) fail();
    if (kind === "vide") {
      if (description.type !== "avc1")
        fail("Only H.264/AVC MP4 video is supported.");
      bound(description.data, 78, description.end);
      if (!u16(description.data + 24) || !u16(description.data + 26)) fail();
      const avc = one(boxes(description.data + 78, description.end), "avcC");
      bound(avc.data, 7, avc.end);
      if (
        bytes[avc.data] !== 1 ||
        ![0, 1, 3].includes(bytes[avc.data + 4] & 3) ||
        !(bytes[avc.data + 5] & 31)
      )
        fail();
      let cursor = avc.data + 6;
      const spsCount = bytes[avc.data + 5] & 31;
      for (let index = 0; index < spsCount; index++) {
        bound(cursor, 2, avc.end);
        const length = u16(cursor);
        cursor += 2;
        bound(cursor, length, avc.end);
        if (!length || (bytes[cursor] & 31) !== 7) fail();
        cursor += length;
      }
      bound(cursor, 1, avc.end);
      const ppsCount = bytes[cursor++];
      if (!ppsCount) fail();
      for (let index = 0; index < ppsCount; index++) {
        bound(cursor, 2, avc.end);
        const length = u16(cursor);
        cursor += 2;
        bound(cursor, length, avc.end);
        if (!length || (bytes[cursor] & 31) !== 8) fail();
        cursor += length;
      }
    } else {
      if (description.type !== "mp4a")
        fail("Only AAC-LC audio in MP4 is supported.");
      bound(description.data, 28, description.end);
      if (u16(description.data + 8) !== 0) fail();
      const esds = one(boxes(description.data + 28, description.end), "esds");
      full(esds, 4);
      const descriptor = (start: number, end: number, tag: number) => {
        bound(start, 2, end);
        if (bytes[start++] !== tag) fail();
        let length = 0,
          finished = false;
        for (let n = 0; n < 4; n++) {
          bound(start, 1, end);
          const value = bytes[start++];
          length = length * 128 + (value & 127);
          if (!(value & 128)) {
            finished = true;
            break;
          }
        }
        if (!finished) fail();
        bound(start, length, end);
        return { start, end: start + length };
      };
      const es = descriptor(esds.data + 4, esds.end, 3);
      bound(es.start, 3, es.end);
      const flags = bytes[es.start + 2];
      if (flags !== 0) fail();
      const config = descriptor(es.start + 3, es.end, 4);
      bound(config.start, 13, config.end);
      if (bytes[config.start] !== 0x40 || bytes[config.start + 1] >> 2 !== 5)
        fail("Only AAC-LC audio in MP4 is supported.");
      const specific = descriptor(config.start + 13, config.end, 5);
      bound(specific.start, 2, specific.end);
      if (bytes[specific.start] >> 3 !== 2)
        fail("Only AAC-LC audio in MP4 is supported.");
    }
    const stts = one(tables, "stts");
    full(stts, 8);
    const timingCount = u32(stts.data + 4);
    bound(stts.data + 8, timingCount * 8, stts.end);
    if (stts.data + 8 + timingCount * 8 !== stts.end) fail();
    let sampleCount = 0,
      ticks = 0;
    for (let index = 0; index < timingCount; index++) {
      const count = u32(stts.data + 8 + index * 8),
        delta = u32(stts.data + 12 + index * 8);
      if (!count || !delta) fail();
      sampleCount += count;
      ticks += count * delta;
      if (sampleCount > 100000 || !Number.isSafeInteger(ticks)) fail();
    }
    if (
      !sampleCount ||
      ticks !== mediaTime.ticks ||
      (compositionSamples !== undefined && compositionSamples !== sampleCount)
    )
      fail("The MP4 duration does not match its media sample timings.");
    const stsz = one(tables, "stsz");
    full(stsz, 12);
    const fixedSize = u32(stsz.data + 4);
    if (u32(stsz.data + 8) !== sampleCount)
      fail("The MP4 sample counts do not match.");
    if (stsz.data + 12 + (fixedSize ? 0 : sampleCount * 4) !== stsz.end) fail();
    const sizes = Array.from(
      { length: sampleCount },
      (_, index) => fixedSize || u32(stsz.data + 12 + index * 4),
    );
    if (sizes.some((size) => !size || size > bytes.length)) fail();
    const offsets = tables.filter(
      (box) => box.type === "stco" || box.type === "co64",
    );
    if (offsets.length !== 1) fail();
    const offsetBox = offsets[0];
    full(offsetBox, 8);
    const chunkCount = u32(offsetBox.data + 4),
      width = offsetBox.type === "co64" ? 8 : 4;
    if (
      !chunkCount ||
      chunkCount > sampleCount ||
      offsetBox.data + 8 + chunkCount * width !== offsetBox.end
    )
      fail();
    const stsc = one(tables, "stsc");
    full(stsc, 8);
    const mapCount = u32(stsc.data + 4);
    if (
      !mapCount ||
      mapCount > chunkCount ||
      stsc.data + 8 + mapCount * 12 !== stsc.end
    )
      fail();
    const mappings = Array.from({ length: mapCount }, (_, index) => ({
      first: u32(stsc.data + 8 + index * 12),
      count: u32(stsc.data + 12 + index * 12),
      description: u32(stsc.data + 16 + index * 12),
    }));
    if (
      mappings[0].first !== 1 ||
      mappings.some(
        (m, index) =>
          !m.count ||
          m.first > chunkCount ||
          m.description !== 1 ||
          (index > 0 && m.first <= mappings[index - 1].first),
      )
    )
      fail();
    let mapping = 0,
      sample = 0;
    for (let index = 0; index < chunkCount; index++) {
      while (
        mapping + 1 < mappings.length &&
        mappings[mapping + 1].first <= index + 1
      )
        mapping++;
      const count = mappings[mapping].count;
      if (sample + count > sampleCount) fail();
      let length = 0;
      for (let n = 0; n < count; n++) length += sizes[sample++];
      const start =
        width === 8
          ? u64(offsetBox.data + 8 + index * width)
          : u32(offsetBox.data + 8 + index * width);
      const end = start + length;
      if (
        !Number.isSafeInteger(end) ||
        !media.some((box) => start >= box.data && end <= box.end)
      )
        fail("The MP4 references missing or external media bytes.");
      ranges.push({ start, end });
    }
    if (sample !== sampleCount) fail("The MP4 sample tables are incomplete.");
  }
  if (!kinds.includes("vide")) fail("Choose an MP4 with an H.264 video track.");
  if (Math.abs(movieTime.seconds - maximumTrackTime) > 1 / movieTime.scale)
    fail("The MP4 has inconsistent movie and track durations.");
  ranges.sort((a, b) => a.start - b.start);
  if (
    ranges.some(
      (range, index) => index > 0 && range.start < ranges[index - 1].end,
    )
  )
    fail("The MP4 media chunks overlap.");
  return {
    mime: "video/mp4",
    extension: "mp4",
    durationSeconds: Math.max(movieTime.seconds, maximumTrackTime),
    videoCodec: "avc1",
    ...(kinds.includes("soun") ? { audioCodec: "mp4a" as const } : {}),
  };
}
