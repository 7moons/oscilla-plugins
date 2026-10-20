// SponsorBlock for Oxitune (plugin API 1): fetches segments for each song from
// sponsor.ajay.app (the only host its manifest allows) and seeks past each
// one once. Stands down while this app follows someone else's playback
// (a Listen Together guest).

var CATEGORIES = ['music_offtopic', 'intro', 'outro', 'sponsor', 'selfpromo'];

/** A response for a song the user already left must not be applied. */
function isFreshSegmentResponse(requestedVideoId, latestVideoId) {
  return requestedVideoId === latestVideoId;
}

function segmentsUrl(videoId, categories) {
  return (
    'https://sponsor.ajay.app/api/skipSegments?videoID=' +
    encodeURIComponent(videoId) +
    '&categories=' +
    encodeURIComponent(JSON.stringify(categories))
  );
}

/** The segment to skip at `time`, if any (each only once). */
function segmentToSkip(segments, time, skipped) {
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var start = seg.segment[0];
    var end = seg.segment[1];
    if (time >= start && time < end - 0.5 && !skipped.has(seg.UUID)) return seg;
  }
  return null;
}

function start(oxitune) {
  var segments = [];
  var lastVideoId = '';
  var skipped = new Set();

  function enabledCategories() {
    var values = oxitune.settings.all();
    return CATEGORIES.filter(function (c) {
      return values[c] !== false;
    });
  }

  oxitune.player.onTrackChange(function (track) {
    if (!track.videoId || track.videoId === lastVideoId) return;
    var requested = track.videoId;
    lastVideoId = requested;
    segments = [];
    skipped = new Set();
    var categories = enabledCategories();
    if (categories.length === 0) return;
    oxitune.net
      .fetchJson(segmentsUrl(requested, categories))
      .then(function (data) {
        if (!isFreshSegmentResponse(requested, lastVideoId) || !Array.isArray(data)) return;
        segments = data;
      })
      .catch(function () {
        // No segments for this song (404), or offline.
      });
  });

  oxitune.player.onTick(function (time) {
    if (segments.length === 0 || !oxitune.player.canSeekAutomatically()) return;
    var seg = segmentToSkip(segments, time, skipped);
    if (!seg) return;
    skipped.add(seg.UUID);
    oxitune.player.seek(seg.segment[1]);
  });
}

if (typeof oxitune !== 'undefined') {
  start(oxitune);
}

if (typeof module !== 'undefined') {
  module.exports = { isFreshSegmentResponse: isFreshSegmentResponse, segmentToSkip: segmentToSkip, segmentsUrl: segmentsUrl };
}
