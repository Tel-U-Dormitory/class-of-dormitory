# CoD on the existing 1 vCPU / ~1 GiB shared host

The kernel previously OOM-killed mysqld. This profile reduces the working set and
queues excess PHP requests instead of allowing 150 prefork workers to grow.
It is a starting resource budget, not a guarantee of 170 concurrent exam users.

- Apache: 2 initial workers, 1–2 spare, at most 4, recycled after 300 requests.
- PHP: 128 MiB/request, 64 MiB shared OPcache. PHP request limits are not container limits.
- CoD web: 256 MiB RAM / 384 MiB RAM+swap ceiling.
- Scheduler: 128 MiB RAM / 192 MiB RAM+swap ceiling.
- MySQL: 320 MiB RAM / 384 MiB RAM+swap ceiling, 64 MiB buffer pool, 24 connections,
  performance_schema and unused MySQL X disabled. Durable commit flushing remains on.
- Monitor polling: 10 seconds, configurable with EXAM_MONITOR_POLL_SECONDS.

Shared Resora MySQL remains a separate Compose project. Back up its configuration,
database, and CoD upload volume before applying changes during maintenance. Mount
`docker/mysql-low-memory.cnf` read-only into `/etc/mysql/conf.d/cod-low-memory.cnf`
on the EXISTING MySQL service, then recreate only that service with its existing
project name, network, environment, and data volume. Do not run `down -v` or create
a replacement volume. Disabling performance_schema requires a MySQL restart and
temporarily removes its query instrumentation; the slow query log is separate.
Do not extract SQL backups or secrets into image build contexts.

The server's existing `/opt/cod/compose.yaml` can keep its image literal and external
networks. Copy only the app/scheduler memory limits above; keep project
`cod-production`, alias `cod-web`, and volume `storage` unchanged. Default deploy
script options target compose.production.yaml, so use `-f compose.yaml` on Resora.

Scoring now writes answers in chunks of 250 rather than one UPDATE per answer.
Subtest submit stays one batch request; HTTP timeout retry accepts only a matching
previously committed manual submission and never advances another section.
Partial/rejected responses retain the browser snapshot and do not manually finish
the section. They require recovery/supervisor attention instead of silent deletion.
Heartbeat carries the server deadline so extensions refresh the participant view.
No additional Redis, queue worker, or periodic answer upload process was introduced.

Vite still emits HTML asset tags, but the optional HTTP Link preload middleware is
removed: NPM previously rejected large response headers. Do not solve this with
longer proxy timeouts.

After deploy verify health, an authenticated exam settings page, upload persistence,
subtest transitions, matching submit retries, final scores, scheduler task output,
and host/container memory. Existing swap may remain used after pressure subsides;
watch available RAM and active swap-in/out, not just swap occupancy. Do not swapoff
on a pressured host. Container limits protect neighbors but can kill a container
if its budget is exceeded; tune from measured peaks, not by increasing all limits.

Run realistic tests progressively (8, 30, 80, then 170) with test identities/data,
bounded duration, realistic media, final-submit bursts, and stop conditions for
errors, OOM, latency, or pressure. Never load test an active exam or production
participants. A health check alone does not prove concurrency capacity.
