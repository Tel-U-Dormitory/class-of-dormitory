# Production latency investigation — 2026-11-20

The previous navigation/results optimizations are deployed at c99fc30. The
remaining slowdown is not yet attributed solely to score adjustment.

Observed during this investigation (individual samples, not load-test medians):

| Probe | Result |
| --- | --- |
| Container loopback `/up` | TTFB 8.9 ms, total 9.5 ms |
| Container loopback `/` | TTFB 42.33 s |
| Public HTTPS `/up` | One 30 s timeout; later 7.46 s total, including 5.74 s through TLS handshake |
| Comparison HTTPS `example.com` from the same local client | 1.53 s total |
| Host snapshot | Load 0.00/0.02/0.00; 427 MiB available of 961 MiB; app 62.88 MiB/400 MiB |
| Gateway SSH | Intermittent handshake timeouts; one regional executor lost; later probes could not finish |

Cache and sessions are already local files. Proxy gzip was already enabled.
A database connection probe did not complete within its job deadline, but SSH
transport problems prevent treating that as a reliable database-only timing.
Query-level timings and an old/new image comparison remain necessary. No
production database or score values were modified during this investigation.

## Application mitigation

The public landing page now sends its static content and navigation first.
Exam details, published personal result, cast availability and documentation
are returned together by an Inertia deferred request. The static view displays
skeletons for the schedule and documentation while waiting. This removes exam
and documentation queries from the initial response. With a warm local settings
cache, the anonymous initial response performs zero database queries, verified
by a regression test. Authenticated session validation may still require a query.
No shared response cache contains personal results.

The participant/public layout no longer runs a full-screen canvas animation on
every animation frame. Cast reveal and arena retain their intentional effects.

This mitigation does not repair public network latency or make login/exam writes
independent of the database. It must not be reported as production recovery
until deployed and measured through the public domain.

## Recovery and verification

1. Restore reliable host access; inspect packet loss/retransmissions, database
   connection time, repeated query time and proxy/app timings separately.
2. Check active exam attempts before any application recreation. Preserve the
   persistent storage volume, session files and current score columns.
3. Compare current and pre-feature images against the same data using read-only
   requests. Roll back application code only if that comparison shows recovery;
   do not run migration rollback or remove score adjustment columns.
4. Deploy the pinned tested image, then repeat loopback and public measurements
   and verify initial/deferred responses, login, and existing score adjustments.
