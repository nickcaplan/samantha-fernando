# Loading stability check

Scope: issue #90, Home, Works, Listen and Watch. Local normal production-format fallback build, real Google Fonts and Font Awesome, Chromium, 390x900 and 1440x900, actual light/dark body themes. Three fresh contexts per theme/page/width; one cold and one warm navigation per context. No input, no forms, no preview or production deployment. Measurement window: load event plus 1.5 seconds, buffered layout-shift entries excluding recent input. These are environment-specific observations, not field performance guarantees.

Isolation: blocking Google Fonts removed the observed shifts; blocking Font Awesome did not. The change only switches Google Fonts from swap to optional. It does not hide the page or wait on a JavaScript font gate. If a webfont misses the short initial rendering window, the page retains its fallback font for that load instead of moving already-painted text. A later warm load can use the cached webfont.

## Before and after

Each cold CLS value is the maximum of six samples (both themes, three repeats). FCP is the median of those same samples. Warm CLS was zero for every before/after sample. After: 48 cold and 48 warm loads, all zero measured CLS.

| Width | Page | Before max cold CLS | After max cold CLS | Before median cold FCP | After median cold FCP |
| --- | --- | --- | --- | --- | --- |
| 390 | / | 0.000000 | 0.000000 | 160ms | 162ms |
| 390 | /works/ | 0.019921 | 0.000000 | 140ms | 148ms |
| 390 | /listen/ | 0.007823 | 0.000000 | 128ms | 126ms |
| 390 | /watch/ | 0.000044 | 0.000000 | 140ms | 130ms |
| 1440 | / | 0.010771 | 0.000000 | 160ms | 176ms |
| 1440 | /works/ | 0.002919 | 0.000000 | 154ms | 152ms |
| 1440 | /listen/ | 0.000324 | 0.000000 | 144ms | 144ms |
| 1440 | /watch/ | 0.000282 | 0.000000 | 140ms | 146ms |

Largest median FCP increase was 16ms on desktop Home in this sample; others ranged from -10ms to +8ms. This is not enough evidence to claim a statistically significant speed change. No added script, production font file or request.

## Regression proof

The controlled late-font test uses a real licensed font with different fallback metrics, waits for first contentful paint and then releases it. It verifies a font request, successful load and buffered shift entries, not just the URL string. Original swap: 14 fail, 2 unaffected phone Home cases pass. Optional: 16 pass. Firefox/WebKit do not implement the observer, so this spec skips there rather than asserting invented metrics.

Real audio output is outside these measurements and remains a separate check. Existing provider mocks are not proof of sound.
